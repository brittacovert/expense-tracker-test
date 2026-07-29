import { env } from "cloudflare:workers";

type AccessClaims = {
  aud?: string | string[];
  email?: string;
  sub?: string;
  exp?: number;
  iss?: string;
};

const decode = (value: string) => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
};

async function verifyCloudflareAccess(token: string): Promise<AccessClaims | null> {
  const teamDomain = (env as unknown as { ACCESS_TEAM_DOMAIN?: string }).ACCESS_TEAM_DOMAIN?.replace(/\/$/, "");
  const audience = (env as unknown as { ACCESS_AUD?: string }).ACCESS_AUD;
  if (!teamDomain || !audience) return null;

  try {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
    if (!encodedHeader || !encodedPayload || !encodedSignature) return null;
    const header = JSON.parse(new TextDecoder().decode(decode(encodedHeader))) as { kid?: string; alg?: string };
    const claims = JSON.parse(new TextDecoder().decode(decode(encodedPayload))) as AccessClaims;
    if (!header.kid || header.alg !== "RS256") return null;

    const certs = await fetch(`${teamDomain}/cdn-cgi/access/certs`).then(response => response.json()) as {
      keys?: JsonWebKey[];
    };
    const jwk = certs.keys?.find(key => key.kid === header.kid);
    if (!jwk) return null;
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const verified = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      decode(encodedSignature),
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    );
    const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
    const expectedIssuer = teamDomain.endsWith("/") ? teamDomain : `${teamDomain}`;
    if (!verified || !audiences.includes(audience) || !claims.exp || claims.exp * 1000 <= Date.now()) return null;
    if (claims.iss && claims.iss.replace(/\/$/, "") !== expectedIssuer.replace(/\/$/, "")) return null;
    return claims;
  } catch {
    return null;
  }
}

export async function authenticatedUserId(request: Request): Promise<string | null> {
  const accessTeam = (env as unknown as { ACCESS_TEAM_DOMAIN?: string }).ACCESS_TEAM_DOMAIN;
  if (accessTeam) {
    const token = request.headers.get("cf-access-jwt-assertion");
    if (!token) return null;
    const claims = await verifyCloudflareAccess(token);
    return claims?.sub || claims?.email?.toLowerCase() || null;
  }

  // ChatGPT Sites verifies this identity header before it reaches the Worker.
  const sitesEmail = request.headers.get("oai-authenticated-user-email");
  return sitesEmail?.trim().toLowerCase() || null;
}
