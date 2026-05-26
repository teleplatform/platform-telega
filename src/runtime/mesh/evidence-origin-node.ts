export interface EvidenceOrigin {
  nodeId: string;
  nodeName: string;
  nodeKind: string;
  version: string;
  capabilities: string[];
  timestamp: number;
  signature: string;
}

export interface OriginVerification {
  origin: EvidenceOrigin;
  verified: boolean;
  reason: string;
  verifiedAt: number;
}

export interface TrustedOrigin {
  nodeId: string;
  nodeName: string;
  nodeKind: string;
  registeredAt: number;
  lastVerifiedAt: number;
  status: 'trusted' | 'suspicious' | 'banned';
  trustScore: number;
}

export class EvidenceOriginNodeService {
  private trustedOrigins: Map<string, TrustedOrigin> = new Map();
  private allowedOrigins: string[] = [];

  constructor(allowedOrigins: string[] = []) {
    this.allowedOrigins = allowedOrigins;
  }

  registerOrigin(origin: EvidenceOrigin, trustScore: number = 100): TrustedOrigin {
    const trusted: TrustedOrigin = {
      nodeId: origin.nodeId,
      nodeName: origin.nodeName,
      nodeKind: origin.nodeKind,
      registeredAt: Date.now(),
      lastVerifiedAt: Date.now(),
      status: 'trusted',
      trustScore,
    };

    this.trustedOrigins.set(origin.nodeId, trusted);
    return trusted;
  }

  verifyOrigin(origin: EvidenceOrigin): OriginVerification {
    // Check if origin is in allowed list
    if (this.allowedOrigins.length > 0 && !this.allowedOrigins.includes(origin.nodeId)) {
      return {
        origin,
        verified: false,
        reason: 'Origin not in allowed list',
        verifiedAt: Date.now(),
      };
    }

    // Check if origin has a valid signature
    if (!origin.signature || origin.signature.length < 10) {
      return {
        origin,
        verified: false,
        reason: 'Invalid signature',
        verifiedAt: Date.now(),
      };
    }

    // Check if origin is already trusted
    const trusted = this.trustedOrigins.get(origin.nodeId);
    if (trusted) {
      if (trusted.status === 'banned') {
        return {
          origin,
          verified: false,
          reason: 'Origin is banned',
          verifiedAt: Date.now(),
        };
      }

      // Update trust score based on recent activity
      if (trustScoreDelta(origin, trusted) > 0) {
        trusted.trustScore = Math.min(100, trusted.trustScore + 5);
      }

      trusted.lastVerifiedAt = Date.now();

      return {
        origin,
        verified: true,
        reason: 'Origin is trusted',
        verifiedAt: Date.now(),
      };
    }

    // Check if node capabilities match
    if (origin.capabilities.length === 0) {
      return {
        origin,
        verified: false,
        reason: 'No capabilities reported',
        verifiedAt: Date.now(),
      };
    }

    // New origin - register it with default trust
    this.registerOrigin(origin, 50);

    return {
      origin,
      verified: true,
      reason: 'Origin registered and verified',
      verifiedAt: Date.now(),
    };
  }

  markOriginSuspicious(nodeId: string, reason: string): void {
    const trusted = this.trustedOrigins.get(nodeId);
    if (trusted) {
      trusted.status = 'suspicious';
      trusted.trustScore = Math.max(0, trusted.trustScore - 25);
    }
  }

  banOrigin(nodeId: string, reason: string): void {
    const trusted = this.trustedOrigins.get(nodeId);
    if (trusted) {
      trusted.status = 'banned';
      trusted.trustScore = 0;
    }
  }

  getOriginTrust(nodeId: string): { status: string; trustScore: number } | null {
    const trusted = this.trustedOrigins.get(nodeId);
    if (!trusted) return null;

    return {
      status: trusted.status,
      trustScore: trusted.trustScore,
    };
  }

  getAllOrigins(): TrustedOrigin[] {
    return Array.from(this.trustedOrigins.values());
  }
}

function trustScoreDelta(origin: EvidenceOrigin, trusted: TrustedOrigin): number {
  // Simplified - in production this would check reputation
  return 0;
}