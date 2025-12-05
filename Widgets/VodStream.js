const RESOURCE_SITES = [
  {title: "电影天堂",value:"http://caiji.dyttzyapi.com/api.php/provide/vod/"},
  {title: "非凡影视",value:"http://ffzy4.tv/api.php/provide/vod/"},
  {title: "如意资源站",value: "https://ryzy.tv/api.php/provide/vod/at/json/"},
  {title: "量子资源站",value: "https://cj.lziapi.com/api.php/provide/vod/at/json/"},
  {title: "爱奇艺资源站",value: "https://iqiyizyapi.com/api.php/provide/vod/"}
];

WidgetMetadata = {
  id: "vod_stream",
  title: "VOD Stream",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.1.0",
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
 * 根据指定集数查找对应的播放链接
 */
function findEpisodeUrl(playSource, targetEpisode) {
  if (!playSource.includes('#')) {
    return null; // 不是电视剧格式
  }
  
  const episodes = playSource.split('#').filter(ep => ep.trim() !== '');
  
  for (const episode of episodes) {
    if (!episode.includes('$')) continue;
    
    const parts = episode.split('$');
    if (parts.length < 2) continue;
    
    const episodeName = parts[0] || '';
    const url = parts[1].trim();
    
    // 提取集数 - 支持"第1集"、"第01集"、"第001集"等格式
    const match = episodeName.match(/第(\d+)集/);
    if (match && match[1]) {
      const episodeNumber = parseInt(match[1]); // parseInt会自动去除前导零
      
      // 检查是否匹配目标集数
      if (episodeNumber === targetEpisode && url) {
        return url;
      }
    }
  }
  
  return null; // 未找到指定集数
}

/**
 * 从资源项中提取播放信息
 */
function extractPlayInfo(item, siteTitle, type, targetEpisode) {
  if (!item.vod_name || !item.vod_play_url || !item.vod_play_from) {
    return [];
  }

  // 清理播放URL（移除末尾的所有#）
  const playUrl = item.vod_play_url.replace(/#+$/, '');
  
  // 分割播放源和源名称
  const playSources = playUrl.split('$$$');
  const sourceNames = item.vod_play_from.split('$$$');
  
  const resources = [];
  
  // 检查所有播放源
  for (let i = 0; i < playSources.length; i++) {
    const playSource = playSources[i];
    let sourceName = sourceNames[i] || '默认源';
    
    // 检查特殊源是否需要添加m3u8
    if (sourceName.toLowerCase().includes('wolong') && !sourceName.toLowerCase().includes('m3u8')) {
      sourceName = sourceName + 'm3u8';
    }
    
    // 只处理源名称包含"m3u8"的资源
    if (!sourceName.toLowerCase().includes('m3u8')) {
      continue;
    }
    
    // 根据请求类型筛选资源
    const isTVSeries = playSource.includes('#');
    
    if (type === 'tv' && isTVSeries) {
      // 电视剧：查找指定集数的播放链接
      if (targetEpisode) {
        const url = findEpisodeUrl(playSource, targetEpisode);
        
        if (url) {
          resources.push({
            name: siteTitle,
            description: `${item.vod_name} 第${targetEpisode}集 • ${item.vod_remarks} - [${sourceName}]`,
            url: url
          });
        }
      } else {
        // 如果没有指定集数，返回总集数信息
        const episodes = playSource.split('#').filter(ep => ep.trim() !== '');
        const totalEpisodes = episodes.length;
        
        if (totalEpisodes > 0) {
          // 返回第一集作为示例（如果需要的话）
          const firstEpisode = episodes[0];
          let sampleUrl = '';
          if (firstEpisode.includes('$')) {
            const parts = firstEpisode.split('$');
            if (parts.length >= 2) {
              sampleUrl = parts[1].trim();
            }
          }
          
          resources.push({
            name: siteTitle,
            description: `${item.vod_name} 电视剧 • ${totalEpisodes}集 - [${sourceName}]`,
            url: sampleUrl // 返回第一集作为示例，可以为空
          });
        }
      }
    } else if (type === 'movie' && !isTVSeries) {

      const versions = playSource.split('#');
      
      for (const version of versions) {
        if (!version.includes('$')) {
          console.log(`版本格式错误: ${version}`);
          continue;
        }
        
        const parts = version.split('$');
        if (parts.length < 2) {
          continue;
        }
        
        const quality = parts[0] || '';
        let url = parts[1].trim();
        
        // 如果有更多部分（可能是备用URL），只取第一个URL
        if (url.includes('#')) {
          url = url.split('#')[0].trim();
        }
        
        if (url) {
          
          // 判断质量描述
          const qualityDesc = quality.includes('TC') ? quality : '正片';
          
          resources.push({
            name: siteTitle,
            description: `${item.vod_name} 电影 • ${qualityDesc} - [${sourceName}]`,
            url: url
          });
        }
      }
    }
  }
  
  console.log(`总共找到资源: ${resources.length}个`);
  return resources;
}

async function loadResource(params) {
  const { seriesName, type, episode } = params;
  
  const searchTerm = seriesName.trim();
  const resourceType = type || 'tv'; // 默认为电视剧
  const targetEpisode = episode ? parseInt(episode) : null;
  
  const resources = [];
  
  try {
    // 并行请求所有站点
    const requests = RESOURCE_SITES.map(async (site) => {
      try {
        const response = await Widget.http.get(site.value, {
          params: { ac: "detail", wd: searchTerm }
        });
        
        if (response.data?.code === 1 && response.data.list?.length > 0) {

          return {
            site: site.title,
            data: response.data.list
          };
        } else {
          console.log(`${site.title}: 没有找到结果`);
        }
      } catch (error) {
        console.log(`${site.title}: 请求失败`, error);
      }
      return null;
    });
    
    const results = await Promise.all(requests);
    
    // 处理搜索结果
    for (const result of results) {
      if (!result?.data) continue;
      
      for (const item of result.data) {
        // 精确匹配电影名称
        if (item.vod_name?.trim() !== searchTerm) {
          console.log(`不匹配: "${item.vod_name?.trim()}" !== "${searchTerm}"`);
          continue;
        }

        const items = extractPlayInfo(item, result.site, resourceType, targetEpisode);
        if (items.length > 0) {
          resources.push(...items);
        }
      }
    }
    
    return resources;
    
  } catch (error) {
    return [];
  }
}