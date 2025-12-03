const RESOURCE_SITES = [
  {
    title: "极速资源",
    value: "https://jszyapi.com/api.php/provide/vod/",
  },
  {
    title: "虾米资源",
    value: "https://gctf.tfdh.top/api.php/provide/vod/",
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
  {
    title: "先锋资源",
    value: "http://60.204.225.89:1122/api.php/provide/vod/",
  },
];

WidgetMetadata = {
  id: "vod_sream",
  title: "VOD Stream",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.0.0",
  requiredVersion: "0.0.1",
  description: "聚合VOD资源",
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

async function loadResource(params) {
  const { seriesName, episode, type } = params;
  
  console.log(`开始搜索: ${seriesName}, 类型: ${type}, 集数: ${episode}`);
  
  const queryParams = {
    ac: "videolist",
    wd: seriesName,
    pg: 1
  };
  
  try {
    // 并发所有接口
    const responses = await Promise.all(
      RESOURCE_SITES.map(async (site) => {
        try {
          const response = await Widget.http.get(site.value, { params: queryParams });
          
          if (response.data && response.data.code === 1 && response.data.list && response.data.list.length > 0) {
            console.log(`${site.title} 返回数据成功，数量: ${response.data.list.length}`);
            return { 
              site: site.title, 
              data: response.data.list
            };
          } else {
            console.log(`${site.title} 无数据或请求失败`);
          }
          return null;
        } catch (error) {
          console.error(`请求 ${site.title} 失败:`, error);
          return null;
        }
      })
    );
    
    const resources = [];

    // 需要过滤的播放源名称
    const FILTERED_SOURCES = ['qq', 'youku', 'mgtv', 'bilibili', 'qiyi'];
    
    // 处理每个接口的响应
    responses.forEach((result) => {
      if (!result || !result.data) return;

      console.log(`处理 ${result.site} 的数据，数量: ${result.data.length}`);

      // 遍历数据
      result.data.forEach((item, index) => {
        console.log(`[${index}] 检查项目: "${item.vod_name}"`);
        
        // 检查名称是否匹配
        if (!item.vod_name || !seriesName) {
          console.log(`  -> 名称或搜索词为空`);
          return;
        }
        
        // 类型判断逻辑
        if (type === 'movie') {
          // 电影：使用精确匹配
          if (item.vod_name !== seriesName) {
            console.log(`  -> 电影名称不匹配: "${item.vod_name}" !== "${seriesName}"`);
            return;
          }
          console.log(`  -> 电影名称匹配成功`);
        } else {
          // 电视剧：使用宽松匹配
          const isMatch = item.vod_name === seriesName || 
                         item.vod_name.includes(seriesName) ||
                         (seriesName && seriesName.includes(item.vod_name));
          if (!isMatch) {
            console.log(`  -> 电视剧名称不匹配: "${item.vod_name}" !== "${seriesName}"`);
            return;
          }
          console.log(`  -> 电视剧名称匹配成功`);
        }
        
        if (!item.vod_play_url) {
          console.log(`  -> 没有播放地址`);
          return;
        }
        
        console.log(`  -> 播放地址: ${item.vod_play_url.substring(0, 50)}...`);
        
        if (type === 'movie') {
          // 电影处理逻辑 - 返回所有版本播放地址
          const playUrl = item.vod_play_url;
          const playFrom = item.vod_play_from || '';
          
          console.log(`  -> vod_play_from: ${playFrom}`);
          
          // 获取播放源名称数组
          let sourceNames = [];
          if (playFrom && playFrom.includes('$$$')) {
            sourceNames = playFrom.split('$$$');
          } else if (playFrom) {
            sourceNames = [playFrom];
          } else {
            sourceNames = ['默认源'];
          }
          
          console.log(`  -> 源名称数组: ${JSON.stringify(sourceNames)}`);
          
          // 检查是否有多个播放源版本（用 $$$ 分隔）
          if (playUrl.includes('$$$')) {
            // 多个播放源版本的情况 - 处理每个版本
            const playSources = playUrl.split('$$$');
            console.log(`  -> 发现多个播放源: ${playSources.length} 个`);
            
            playSources.forEach((source, sourceIndex) => {
              const sourceName = sourceNames[sourceIndex] || `版本${sourceIndex + 1}`;
              
              // 检查是否需要过滤此播放源
              if (FILTERED_SOURCES.includes(sourceName)) {
                console.log(`  -> 过滤播放源: ${sourceName}`);
                return; // 跳过这个播放源
              }
              
              if (source && source.includes('$')) {
                // 格式：质量标识$URL
                const parts = source.split('$');
                if (parts.length >= 2) {
                  const qualityLabel = parts[0] || ''; // HD中字、正片、HD等
                  const url = parts[1];
                  
                  resources.push({
                    name: result.site,
                    description: `${item.vod_name}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
                    url: url.trim()
                  });
                  console.log(`  -> 添加资源: ${qualityLabel} [${sourceName}]`);
                } else {
                  console.log(`  -> 播放源格式错误，parts长度: ${parts.length}`);
                }
              } else if (source && source.trim()) {
                // 直接是URL
                resources.push({
                  name: result.site,
                  description: `${item.vod_name} [${sourceName}]`,
                  url: source.trim()
                });
                console.log(`  -> 添加资源: [${sourceName}]`);
              }
            });
          } else {
            // 单个播放源版本的情况
            console.log(`  -> 单个播放源`);
            const sourceName = sourceNames[0] || '默认版本';
            
            // 检查是否需要过滤此播放源
            if (FILTERED_SOURCES.includes(sourceName)) {
              console.log(`  -> 过滤播放源: ${sourceName}`);
              return; // 跳过这个播放源
            }
            
            if (playUrl.includes('$')) {
              const parts = playUrl.split('$');
              console.log(`  -> 分割结果 parts: ${JSON.stringify(parts)}`);
              
              if (parts.length >= 2) {
                const qualityLabel = parts[0] || '';
                const url = parts[1];
                
                resources.push({
                  name: result.site,
                  description: `${item.vod_name}${qualityLabel ? ` (${qualityLabel})` : ''} [${sourceName}]`,
                  url: url.trim()
                });
                console.log(`  -> 添加单个资源: ${qualityLabel} [${sourceName}]`);
              } else {
                console.log(`  -> 单个播放源格式错误，parts长度: ${parts.length}`);
              }
            } else {
              // 直接是URL
              resources.push({
                name: result.site,
                description: `${item.vod_name} [${sourceName}]`,
                url: playUrl.trim()
              });
              console.log(`  -> 添加单个资源(直接URL): [${sourceName}]`);
            }
          }
        } else {
          // 电视剧处理逻辑 - 统一命名方式
          console.log(`  -> 处理电视剧资源`);
          const playUrl = item.vod_play_url;
          const playFrom = item.vod_play_from || '';
          
          // 获取播放源名称数组
          let sourceNames = [];
          if (playFrom && playFrom.includes('$$$')) {
            sourceNames = playFrom.split('$$$');
          } else if (playFrom) {
            sourceNames = [playFrom];
          } else {
            sourceNames = ['默认源'];
          }
          
          // 分割不同的播放源
          const playSources = playUrl.split('$$$');
          
          // 优先使用第二个播放源（m3u8格式）
          let playSourceIndex = 0;
          if (playSources.length >= 2) {
            playSourceIndex = 1;
          }
          
          const playSource = playSources[playSourceIndex];
          const sourceName = sourceNames[playSourceIndex] || `版本${playSourceIndex + 1}`;
          
          // 检查是否需要过滤此播放源
          if (FILTERED_SOURCES.includes(sourceName)) {
            console.log(`  -> 过滤播放源: ${sourceName}`);
            return; // 跳过这个播放源
          }
          
          // 分割剧集
          const episodes = playSource.split('#');
          
          // 如果没有指定具体集数，返回所有剧集
          if (!episode) {
            episodes.forEach((ep, epIndex) => {
              if (!ep || !ep.includes('$')) return;
              
              const [episodeTitle, episodeUrl] = ep.split('$');
              if (episodeUrl) {
                resources.push({
                  name: result.site,
                  description: `${item.vod_name} ${episodeTitle || ''} [${sourceName}]`,
                  url: episodeUrl.trim()
                });
                console.log(`  -> 添加剧集: ${episodeTitle}`);
              }
            });
          } 
          // 如果指定了具体集数，只返回该集
          else {
            // 查找匹配的集数
            let targetEpisode = episode;
            if (typeof episode === 'string' && !isNaN(parseInt(episode))) {
              targetEpisode = parseInt(episode);
            }
            
            const episodeStr = targetEpisode.toString().padStart(2, '0');
            const episodePattern = `第${episodeStr}集`;
            
            episodes.forEach((ep) => {
              if (!ep || !ep.includes('$')) return;
              
              const [episodeTitle, episodeUrl] = ep.split('$');
              
              // 检查是否包含目标集数
              if (episodeTitle && episodeUrl && episodeTitle.includes(episodePattern)) {
                resources.push({
                  name: result.site,
                  description: `${item.vod_name} ${episodeTitle} [${sourceName}]`,
                  url: episodeUrl.trim()
                });
                console.log(`  -> 找到匹配剧集: ${episodeTitle}`);
              }
            });
          }
        }
      });
    });

    return resources;

  } catch (error) {
    console.error("加载资源时发生错误:", error);
    return [];
  }
}