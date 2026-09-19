import { IMusicProvider } from "./interface";
import { MusicSource } from "@/types/music";
import { LocalProvider } from "./providers/local-provider";
import { AggregateProvider } from "./providers/aggregate-provider";
import { PodcastProvider } from "./providers/podcast-provider";
import { AlistProvider } from "./providers/alist-provider";
import { JooxProvider } from "./providers/joox-provider";
import { KuwoProvider } from "./providers/kuwo-provider";
import { KugouApiProvider } from "./providers/kugou-api-provider";
import { MiguApiProvider } from "./providers/migu-api-provider";
import { NeteaseProvider } from "./providers/netease-provider";
import { QqApiProvider } from "./providers/qq-api-provider";
import { NeteaseApiProvider } from "./providers/netease-api-provider";
import { BilibiliApiProvider } from "./providers/bilibili-api-provider";
import { HigequProvider } from "./providers/higequ-provider";
import { JamendoProvider } from "./providers/jamendo-provider";
import { getAggregatedSourcesForSearch } from "@/hooks/use-aggregated-sources";

export class MusicProviderFactory {
  private static instances = new Map<string, IMusicProvider>();

  static getProvider(source: MusicSource): IMusicProvider {
    if (this.instances.has(source)) {
      return this.instances.get(source)!;
    }

    let provider: IMusicProvider;

    switch (source) {
      case "all":
        // Pass the factory method itself as the resolver to avoid circular dependency
        provider = new AggregateProvider(
          (s) => this.getProvider(s),
          () => getAggregatedSourcesForSearch()
        );
        break;
      case "_netease":
        provider = new NeteaseApiProvider(); // 网易云官方 API
        break;
      case "local":
        provider = new LocalProvider();
        break;
      case "podcast":
        provider = new PodcastProvider();
        break;
      case "alist":
        provider = new AlistProvider();
        break;
      case "joox":
        provider = new JooxProvider();
        break;
      case "kuwo":
        provider = new KuwoProvider();
        break;
      case "kugou":
        provider = new KugouApiProvider();
        break;
      case "migu":
        provider = new MiguApiProvider();
        break;
      case "netease":
        provider = new NeteaseProvider();
        break;
      case "qq":
        provider = new QqApiProvider();
        break;
      case "bilibili":
        provider = new BilibiliApiProvider();
        break;
      case "higequ":
        provider = new HigequProvider();
        break;
      case "jamendo":
        provider = new JamendoProvider();
        break;
      default:
        throw new Error(`不支持的音乐源: ${source}`);
    }

    this.instances.set(source, provider);
    return provider;
  }
}
