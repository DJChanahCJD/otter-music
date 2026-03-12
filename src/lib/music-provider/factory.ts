import { IMusicProvider } from "./interface";
import { MusicSource } from "@/types/music";
import { LocalProvider } from "./providers/local-provider";
import { AggregateProvider } from "./providers/aggregate-provider";
import { PodcastProvider } from "./providers/podcast-provider";
import { JooxProvider } from "./providers/joox-provider";
import { KuwoProvider } from "./providers/kuwo-provider";
import { NeteaseProvider } from "./providers/netease-provider";
import { NeteaseApiProvider } from "./providers/netease-api-provider";

export class MusicProviderFactory {
  private static instances = new Map<string, IMusicProvider>();

  static getProvider(source: MusicSource): IMusicProvider {
    if (this.instances.has(source)) {
      return this.instances.get(source)!;
    }

    let provider: IMusicProvider;

    switch (source) {
      case 'all':
        // Pass the factory method itself as the resolver to avoid circular dependency
        provider = new AggregateProvider((s) => this.getProvider(s));
        break;
      case '_netease':
        provider = new NeteaseApiProvider();  // 网易云官方 API
        break;
      case 'local':
        provider = new LocalProvider();
        break;
      case 'podcast':
        provider = new PodcastProvider();
        break;
      case 'joox':
        provider = new JooxProvider();
        break;
      case 'kuwo':
        provider = new KuwoProvider();
        break;
      case 'netease':
        provider = new NeteaseProvider();
        break;
      default:
        throw new Error(`不支持的音乐源: ${source}`);
    }

    this.instances.set(source, provider);
    return provider;
  }

  // TODO: 是否存在冗余
  static createAggregateProvider(): IMusicProvider {
    return new AggregateProvider((s) => this.getProvider(s));
  }
}
