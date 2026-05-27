import {
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { IngressInput } from "@livekit/protocol";
import { AccessToken, IngressClient } from "livekit-server-sdk";

@Injectable()
export class LivekitService {
  constructor(private readonly config: ConfigService) {}

  async issueStreamerToken(room: string, identity: string) {
    return this.issue(room, identity, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });
  }

  async issueViewerToken(room: string, identity: string) {
    return this.issue(room, identity, {
      canPublish: false,
      canSubscribe: true,
      canPublishData: true,
    });
  }

  /** RTMP ingress per OBS: pubblica nella stanza come partecipante `obs-…`. */
  async createRtmpIngress(opts: {
    roomName: string;
    participantIdentity: string;
    participantName?: string;
  }) {
    const client = this.ingressClient();
    return client.createIngress(IngressInput.RTMP_INPUT, {
      name: `rtmp-${opts.roomName}`.slice(0, 64),
      roomName: opts.roomName,
      participantIdentity: opts.participantIdentity,
      participantName: opts.participantName ?? "OBS Studio",
    });
  }

  async deleteIngress(ingressId: string): Promise<void> {
    const client = this.ingressClient();
    await client.deleteIngress(ingressId);
  }

  /** Dettaglio ingress (URL RTMP + stream key) per UI creator. */
  async getIngressById(ingressId: string) {
    const client = this.ingressClient();
    const list = await client.listIngress({ ingressId });
    return list[0] ?? null;
  }

  private ingressClient(): IngressClient {
    const apiKey = this.config.get<string>("LIVEKIT_API_KEY");
    const apiSecret = this.config.get<string>("LIVEKIT_API_SECRET");
    const url = this.config.get<string>("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      throw new ServiceUnavailableException("livekit_non_configurato");
    }
    return new IngressClient(url, apiKey, apiSecret);
  }

  private async issue(
    room: string,
    identity: string,
    grants: {
      canPublish: boolean;
      canSubscribe: boolean;
      canPublishData: boolean;
    },
  ) {
    const apiKey = this.config.get<string>("LIVEKIT_API_KEY");
    const apiSecret = this.config.get<string>("LIVEKIT_API_SECRET");
    const url = this.config.get<string>("LIVEKIT_URL");
    if (!apiKey || !apiSecret || !url) {
      throw new ServiceUnavailableException("livekit_non_configurato");
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity,
      ttl: 6 * 60 * 60,
    });
    token.addGrant({
      room,
      roomJoin: true,
      ...grants,
    });

    return { token: await token.toJwt(), url };
  }
}
