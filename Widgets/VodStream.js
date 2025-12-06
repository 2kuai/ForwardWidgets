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
  version: "1.1.1",
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
 * 检查URL是否为M3U8格式
 */
function isM3U8Url(url) {
  if (!url) return false;
  
  const urlLower = url.toLowerCase();
  return urlLower.includes('.m3u8') || urlLower.includes('m3u8');
}

/**
 * 从剧名中提取季数信息（支持中文数字与阿拉伯数字）
 */
function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };

  // 匹配中文季数格式：第X季 或 第X部 或 第X部（支持中文数字与阿拉伯数字）
  const chineseMatch = seriesName.match(/第([一二三四五六七八九十\d]+)[季部]/);
  if (chineseMatch) {
    const seasonStr = chineseMatch[1];
    let seasonNum = 1;

    // 将中文数字转换为阿拉伯数字
    const chineseNumbers = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
      '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
      '1': 1, '2': 2, '3': 3, '4': 4, '5': 5,
      '6': 6, '7': 7, '8': 8, '9': 9, '10': 10
    };

    seasonNum = chineseNumbers[seasonStr] || parseInt(seasonStr) || 1;

    // 获取基础剧名（去除季数部分）
    const baseName = seriesName.replace(/第[一二三四五六七八九十\d]+[季部]/, '').trim();
    return { baseName, seasonNumber: seasonNum };
  }

  // 匹配纯阿拉伯数字季数：如 "神探狄仁杰2"
  const digitMatch = seriesName.match(/(.+?)(\d+)$/);
  if (digitMatch) {
    const baseName = digitMatch[1].trim();
    const seasonNum = parseInt(digitMatch[2]) || 1;
    return { baseName, seasonNumber: seasonNum };
  }

  // 如果没有季数信息，默认为第1季
  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

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
 * 检查质量信息是否包含TC
 */
function hasTCQuality(qualityInfo) {
  if (!qualityInfo) return false;
  return qualityInfo.toLowerCase().includes('tc');
}

/**
 * 从资源项中提取播放信息
 */
function extractPlayInfo(item, siteTitle, type, targetSeason, targetEpisode) {
  if (!item.vod_name || !item.vod_play_url || !item.vod_play_from) {
    return [];
  }

  // 清理播放URL
  const playUrl = item.vod_play_url.replace(/#+$/, '');
  
  // 分割播放源和源名称
  const playSources = playUrl.split('$$$');
  const sourceNames = item.vod_play_from.split('$$$');
  
  const resources = [];
  
  // 处理所有播放源
  for (let i = 0; i < playSources.length; i++) {
    const playSource = playSources[i];
    const sourceName = sourceNames[i] || '默认源';
    
    const isTVSeries = playSource.includes('#');
    
    if (type === 'tv' && isTVSeries) {
      // 电视剧处理
      if (targetEpisode) {
        // 查找指定集数
        const url = findEpisodeUrl(playSource, targetEpisode);
        
        if (url && isM3U8Url(url)) {
          resources.push({
            name: siteTitle,
            description: `${item.vod_name} • 第${targetEpisode}集 • ${sourceName}`,
            url: url,
            sourceName: sourceName,
            isM3U8: true,
            type: 'tv',
            episode: targetEpisode
          });
        }
      } else {
        // 获取所有集数信息
        const episodes = playSource.split('#').filter(ep => ep.trim() !== '');
        const totalEpisodes = episodes.length;
        
        if (totalEpisodes > 0) {
          // 查找第一个M3U8链接
          let firstM3U8Url = '';
          for (const episode of episodes) {
            if (episode.includes('$')) {
              const parts = episode.split('$');
              if (parts.length >= 2) {
                const url = parts[1].trim();
                if (isM3U8Url(url)) {
                  firstM3U8Url = url;
                  break;
                }
              }
            }
          }
          
          if (firstM3U8Url) {
            resources.push({
              name: siteTitle,
              description: `${item.vod_name} • 电视剧 • 共${totalEpisodes}集 • ${sourceName}`,
              url: firstM3U8Url,
              sourceName: sourceName,
              isM3U8: true,
              type: 'tv',
              totalEpisodes: totalEpisodes
            });
          }
        }
      }
    } else if (type === 'movie' && !isTVSeries) {
      // 电影处理
      const versions = playSource.split('#');
      
      for (const version of versions) {
        if (!version.includes('$')) continue;
        
        const parts = version.split('$');
        if (parts.length < 2) continue;
        
        let url = parts[1].trim();
        
        // 清理URL
        if (url.includes('#')) {
          url = url.split('#')[0].trim();
        }
        
        if (url && isM3U8Url(url)) {
          // 获取质量信息（如果有）
          const qualityInfo = parts[0] || '';
          const hasTC = hasTCQuality(qualityInfo);
          const qualityText = hasTC ? 'TC' : '正片';
          
          resources.push({
            name: siteTitle,
            description: `${item.vod_name} • ${qualityText} • ${sourceName}`,
            url: url,
            sourceName: sourceName,
            isM3U8: true,
            type: 'movie',
            quality: qualityText
          });
          // 电影只取第一个M3U8版本
          break;
        }
      }
    }
  }
  
  return resources;
}

async function loadResource(params) {
  const { seriesName, type, season, episode } = params;
  
  // 解析剧名，获取基础剧名和季数
  const seriesInfo = extractSeasonInfo(seriesName);
  const baseName = seriesInfo.baseName;
  const targetSeason = season ? parseInt(season) : seriesInfo.seasonNumber;
  
  const searchTerm = baseName.trim();
  const resourceType = type || 'tv';
  const targetEpisode = episode ? parseInt(episode) : null;
  
  const allResources = [];
  
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
          console.log(`${site.title}: 未找到 "${searchTerm}" 相关资源`);
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
        const itemName = item.vod_name?.trim();
        
        if (!itemName) continue;
        
        // 提取当前剧集的季数信息
        const itemInfo = extractSeasonInfo(itemName);
        
        // 检查是否匹配：基础剧名相同且季数匹配
        if (itemInfo.baseName !== baseName) {
          console.log(`基础剧名不匹配: "${itemInfo.baseName}" !== "${baseName}"`);
          continue;
        }
        
        // 季数匹配：支持中文数字与阿拉伯数字的互认
        if (itemInfo.seasonNumber !== targetSeason) {
          console.log(`季数不匹配: "${itemName}" 是第${itemInfo.seasonNumber}季，期望第${targetSeason}季`);
          continue;
        }

        console.log(`找到匹配剧集: ${itemName}`);
        const items = extractPlayInfo(item, result.site, resourceType, targetSeason, targetEpisode);
        if (items.length > 0) {
          allResources.push(...items);
        }
      }
    }
    
    // 去重：根据URL去重，避免同一资源多次返回
    const uniqueResources = [];
    const urlSet = new Set();
    
    for (const resource of allResources) {
      if (resource.url && !urlSet.has(resource.url)) {
        urlSet.add(resource.url);
        uniqueResources.push(resource);
      }
    }
    
    console.log(`最终返回 ${uniqueResources.length} 个唯一资源`);
    return uniqueResources;
    
  } catch (error) {
    console.error('加载资源时发生错误:', error);
    return [];
  }
}