const RESOURCE_SITES = [
  {
    title: "电影天堂",
    value:"http://caiji.dyttzyapi.com/api.php/provide/vod/"
  },
  {
    title: "卧龙资源",
    value:"https://collect.wolongzy.cc/api.php/provide/vod/"
  },
  {
    title: "非凡影视",
    value:"http://ffzy4.tv/api.php/provide/vod/"
  },
  {
    title: "艾蛋资源",
    value:"https://www.lovedan.net/api.php/provide/vod/"
  },
  {
    title: "爱奇艺采集",
    value:"https://iqiyizyapi.com/api.php/provide/vod/"
  },
  {
    title: "360资源",
    value:"https://360zyapi.com/api.php/provide/vod/"
  },
  {
    title: "猫眼资源",
    value:"https://api.maoyanapi.top/api.php/provide/vod/"
  },
  {
    title: "茅台资源",
    value:"https://caiji.maotaizy.cc/api.php/provide/vod/from/mtm3u8/at/josn/"
  },
  {
    title: "极速资源",
    value: "https://jszyapi.com/api.php/provide/vod/",
  },
  {
    title: "无尽资源",
    value: "https://api.wujinapi.me/api.php/provide/vod/",
  },
  {
    title: "金鹰资源",
    value: "https://jyzyapi.com/provide/vod/from/jinyingm3u8/at/json",
  },
  {
    title: "量子资源",
    value: "https://cj.lziapi.com/api.php/provide/vod/at/json/",
  },
  {
    title: "如意资源",
    value: "https://cj.rycjapi.com/api.php/provide/vod/at/json/",
  },
  {
    title: "阿里资源",
    value: "https://alivod.com/api.php/provide/vod/",
  },
];

// 需要过滤的播放源名称
const FILTERED_SOURCES = new Set(['qq', 'youku', 'mgtv', 'bilibili', 'qiyi', 'jsyun', 'dytt']);

WidgetMetadata = {
  id: "vod_sream",
  title: "VOD Stream",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.208",
  requiredVersion: "0.0.1",
  description: "获取聚合VOD影片资源",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  modules: [
    {
      id: "loadResource",
      title: "加载资源",
      functionName: "loadResource",
      type: "stream",
      params: [],
    }
  ],
};

/**
 * 解析播放源名称
 */
function parseSourceNames(playFrom) {
  if (!playFrom) return ['默认源'];
  return playFrom.includes('$$$') ? playFrom.split('$$$') : [playFrom];
}

/**
 * 清理播放URL，处理特殊格式
 */
function cleanPlayUrl(playUrl) {
  if (!playUrl) return '';
  
  // 处理以##结尾的格式
  if (playUrl.endsWith('##')) {
    return playUrl.slice(0, -2); // 移除最后的##
  }
  
  return playUrl;
}

/**
 * 处理单个资源（通用函数，处理电影和电视剧）
 */
function processResource(item, siteTitle, cleanedVodName, targetEpisode, resources, filteredSources, siteDuration) {
  let playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);
  
  // 清理播放URL
  playUrl = cleanPlayUrl(playUrl);
  
  // 分割不同的播放源
  const playSources = playUrl.includes('$$$') ? playUrl.split('$$$') : [playUrl];
  
  // 优先使用第二个播放源（m3u8格式），如果没有就使用第一个
  let playSourceIndex = playSources.length >= 2 ? 1 : 0;
  const playSource = playSources[playSourceIndex];
  const sourceName = sourceNames[playSourceIndex] || `版本${playSourceIndex + 1}`;
  
  // 检查是否需要过滤此播放源
  if (filteredSources.has(sourceName)) return;
  
  // 判断是否为电视剧格式（包含#分隔符）
  if (playSource.includes('#')) {
    // 电视剧格式：处理剧集
    const episodes = playSource.split('#');
    
    // 如果指定了具体集数，只返回该集
    if (targetEpisode) {
      const episodeStr = targetEpisode.toString().padStart(2, '0');
      const episodePattern = `第${episodeStr}集`;
      
      episodes.forEach((ep) => {
        if (!ep || !ep.includes('$')) return;
        
        const [episodeTitle, episodeUrl] = ep.split('$');
        const url = episodeUrl?.trim();
        
        // 检查是否包含目标集数
        if (url && episodeTitle && episodeTitle.includes(episodePattern)) {
          resources.push({
            name: siteTitle,
            description: `${cleanedVodName} ${episodeTitle} [${sourceName}] - 接口耗时: ${siteDuration}ms`,
            url: url
          });
        }
      });
    }
  } else {
    // 电影格式或单集格式
    if (playSource.includes('$')) {
      const parts = playSource.split('$');
      if (parts.length >= 2) {
        const qualityLabel = parts[0] || '';
        const url = parts[1].trim();
        
        if (url) {
          resources.push({
            name: siteTitle,
            description: `${cleanedVodName}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}] - 接口耗时: ${siteDuration}ms`,
            url: url
          });
        }
      }
    } else if (playSource.trim()) {
      resources.push({
        name: siteTitle,
        description: `${cleanedVodName} [${sourceName}] - 接口耗时: ${siteDuration}ms`,
        url: playSource.trim()
      });
    }
  }
}

async function loadResource(params) {
  const { seriesName, episode, type } = params;
  
  // 记录整个搜索的开始时间（用于整体耗时统计）
  const overallStartTime = Date.now();
  
  if (!seriesName) {
    console.error("搜索词不能为空");
    return [];
  }
  
  // 预处理搜索词（只执行一次）
  const cleanedSeriesName = seriesName.trim();
  console.log(`开始搜索: "${cleanedSeriesName}"`);
  
  // 预处理目标集数（只执行一次）
  let targetEpisode = null;
  if (episode) {
    targetEpisode = typeof episode === 'string' && !isNaN(parseInt(episode)) 
      ? parseInt(episode) 
      : episode;
  }
  
  const queryParams = { ac: "detail", wd: cleanedSeriesName };
  
  try {
    // 记录所有接口并发请求的开始时间
    const concurrentStartTime = Date.now();
    
    // 并行请求所有接口，设置超时和错误处理
    const sitePromises = RESOURCE_SITES.map(async (site) => {
      try {
        // 可以添加超时控制
        const response = await Widget.http.get(site.value, { params: queryParams });
        
        // 计算接口耗时：从并发请求开始到该接口返回
        const siteEndTime = Date.now();
        const siteDuration = siteEndTime - concurrentStartTime;
        
        if (response.data?.code === 1 && response.data.list?.length > 0) {
          console.log(`站点 ${site.title} 接口请求成功，耗时: ${siteDuration}ms，返回 ${response.data.list.length} 条数据`);
          return { 
            site: site.title, 
            data: response.data.list,
            siteDuration: siteDuration // 传递接口耗时
          };
        }
      } catch (error) {
        // 即使请求失败也要计算接口耗时
        const siteEndTime = Date.now();
        const siteDuration = siteEndTime - concurrentStartTime;
        console.log(`站点 ${site.title} 接口请求失败，耗时: ${siteDuration}ms`);
        // 静默处理错误，不中断其他请求
      }
      return null;
    });
    
    const responses = await Promise.all(sitePromises);
    const resources = [];
    
    // 并行处理每个站点的响应
    const processingPromises = responses.map(async (result) => {
      if (!result || !result.data) return;
      
      // 对每个资源进行并行处理
      const resourcePromises = result.data.map(async (item) => {
        // 快速检查必要字段
        if (!item.vod_name || !item.vod_play_url) return;
        
        // 名称精确匹配检查
        const cleanedVodName = item.vod_name.trim();
        if (cleanedVodName !== cleanedSeriesName) {
          return; // 名称不匹配，跳过
        }
        
        // 处理资源（不区分电影/电视剧，只根据play_url格式处理）
        processResource(item, result.site, cleanedVodName, targetEpisode, resources, FILTERED_SOURCES, result.siteDuration);
      });
      
      await Promise.all(resourcePromises);
    });
    
    await Promise.all(processingPromises);
    
    // 计算整体耗时
    const overallEndTime = Date.now();
    const overallDuration = overallEndTime - overallStartTime;
    
    console.log(`搜索完成，找到 ${resources.length} 个资源，总耗时: ${overallDuration}ms`);
    
    // 按接口耗时排序（可选，让耗时短的资源排在前面）
    resources.sort((a, b) => {
      const aDuration = parseInt(a.description.match(/接口耗时: (\d+)ms/)?.[1] || 0);
      const bDuration = parseInt(b.description.match(/接口耗时: (\d+)ms/)?.[1] || 0);
      return aDuration - bDuration;
    });
    
    return resources;

  } catch (error) {
    console.error("加载资源时发生错误:", error);
    return [];
  }
}