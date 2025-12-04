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
    title: "豆瓣资源",
    value:"https://p2100.net/api.php/provide/vod/"
  },
  {
    title: "360资源",
    value:"https://360zy.com/api.php/provide/vod/"
  },
  {
    title: "网易资源",
    value:"https://www.wyvod.com/api.php/provide/vod/"
  },
  {
    title: "猫眼资源",
    value:"https://api.maoyanapi.top/api.php/provide/vod/"
  },
  {
    title: "暴风资源",
    value:"https://bfzyapi.com/api.php/provide/vod/"
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
  version: "1.0.2",
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
 * 处理电影资源
 */
function processMovieResource(item, siteTitle, cleanedVodName, resources, filteredSources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);
  
  // 检查是否有多个播放源版本
  if (playUrl.includes('$$$')) {
    const playSources = playUrl.split('$$$');
    
    playSources.forEach((source, sourceIndex) => {
      const sourceName = sourceNames[sourceIndex] || `版本${sourceIndex + 1}`;
      
      // 检查是否需要过滤此播放源
      if (filteredSources.has(sourceName)) return;
      
      if (source && source.includes('$')) {
        const parts = source.split('$');
        if (parts.length >= 2) {
          const qualityLabel = parts[0] || '';
          const url = parts[1].trim();
          
          if (url) {
            resources.push({
              name: siteTitle,
              description: `${cleanedVodName}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
              url: url
            });
          }
        }
      } else if (source && source.trim()) {
        resources.push({
          name: siteTitle,
          description: `${cleanedVodName} [${sourceName}]`,
          url: source.trim()
        });
      }
    });
  } else {
    // 单个播放源版本
    const sourceName = sourceNames[0] || '默认版本';
    
    if (filteredSources.has(sourceName)) return;
    
    if (playUrl.includes('$')) {
      const parts = playUrl.split('$');
      if (parts.length >= 2) {
        const qualityLabel = parts[0] || '';
        const url = parts[1].trim();
        
        if (url) {
          resources.push({
            name: siteTitle,
            description: `${cleanedVodName}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
            url: url
          });
        }
      }
    } else if (playUrl.trim()) {
      resources.push({
        name: siteTitle,
        description: `${cleanedVodName} [${sourceName}]`,
        url: playUrl.trim()
      });
    }
  }
}

/**
 * 处理电视剧资源
 */
function processTVResource(item, siteTitle, cleanedVodName, targetEpisode, resources, filteredSources) {
  const playUrl = item.vod_play_url;
  const playFrom = item.vod_play_from || '';
  const sourceNames = parseSourceNames(playFrom);
  
  // 分割不同的播放源
  const playSources = playUrl.split('$$$');
  
  // 优先使用第二个播放源（m3u8格式）
  let playSourceIndex = playSources.length >= 2 ? 1 : 0;
  const playSource = playSources[playSourceIndex];
  const sourceName = sourceNames[playSourceIndex] || `版本${playSourceIndex + 1}`;
  
  // 检查是否需要过滤此播放源
  if (filteredSources.has(sourceName)) return;
  
  // 分割剧集
  const episodes = playSource.split('#');
  
  // 如果没有指定具体集数，返回所有剧集
  if (!targetEpisode) {
    episodes.forEach((ep) => {
      if (!ep || !ep.includes('$')) return;
      
      const [episodeTitle, episodeUrl] = ep.split('$');
      const url = episodeUrl?.trim();
      
      if (url) {
        resources.push({
          name: siteTitle,
          description: `${cleanedVodName} ${episodeTitle || ''} [${sourceName}]`,
          url: url
        });
      }
    });
  } else {
    // 如果指定了具体集数，只返回该集
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
          description: `${cleanedVodName} ${episodeTitle} [${sourceName}]`,
          url: url
        });
      }
    });
  }
}

async function loadResource(params) {
  const { seriesName, episode, type } = params;
  
  if (!seriesName) {
    console.error("搜索词不能为空");
    return [];
  }
  
  // 预处理搜索词（只执行一次）
  const cleanedSeriesName = seriesName.trim();
  console.log(`开始搜索: "${cleanedSeriesName}", 类型: ${type}, 集数: ${episode}`);
  
  // 预处理目标集数（只执行一次）
  let targetEpisode = null;
  if (episode) {
    targetEpisode = typeof episode === 'string' && !isNaN(parseInt(episode)) 
      ? parseInt(episode) 
      : episode;
  }
  
  const queryParams = { ac: "detail", wd: cleanedSeriesName };
  
  try {
    // 并行请求所有接口，设置超时和错误处理
    const sitePromises = RESOURCE_SITES.map(async (site) => {
      try {
        // 可以添加超时控制
        const response = await Widget.http.get(site.value, { params: queryParams });
        
        if (response.data?.code === 1 && response.data.list?.length > 0) {
          return { 
            site: site.title, 
            data: response.data.list
          };
        }
      } catch (error) {
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
        
        // 名称匹配检查
        const cleanedVodName = item.vod_name.trim();
        if (cleanedVodName !== cleanedSeriesName) return;
        
        // 类型匹配检查
        const resourceType = item.type_id_1;
        if ((type === 'movie' && resourceType != 1) || 
            (type === 'tv' && resourceType != 2)) {
          return;
        }
        
        // 根据类型处理资源
        if (type === 'movie') {
          processMovieResource(item, result.site, cleanedVodName, resources, FILTERED_SOURCES);
        } else if (type === 'tv') {
          processTVResource(item, result.site, cleanedVodName, targetEpisode, resources, FILTERED_SOURCES);
        }
      });
      
      await Promise.all(resourcePromises);
    });
    
    await Promise.all(processingPromises);
    
    console.log(`搜索完成，找到 ${resources.length} 个资源`);
    return resources;

  } catch (error) {
    console.error("加载资源时发生错误:", error);
    return [];
  }
}