const RESOURCE_SITES = `
电影天堂,http://caiji.dyttzyapi.com/api.php/provide/vod/
非凡影视,http://ffzy4.tv/api.php/provide/vod/
如意资源站,https://cj.rycjapi.com/api.php/provide/vod/at/json/
量子资源站,https://cj.lziapi.com/api.php/provide/vod/at/json/
爱奇艺资源站,https://iqiyizyapi.com/api.php/provide/vod/
`;

WidgetMetadata = {
  id: "vod_stream",
  title: "VOD Stream",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.1.4",
  requiredVersion: "0.0.1",
  description: "获取聚合VOD影片资源",
  author: "两块",
  site: "https://github.com/2kuai/ForwardWidgets",
  globalParams: [
    {
      name: "multiSource",
      title: "是否启用聚合搜索",
      type: "enumeration",
      enumOptions: [
        { title: "启用", value: "enabled" },
        { title: "禁用", value: "disabled" }
      ]
    },
    {
      name: "VodData",
      title: "JSON或CSV格式的源配置",
      type: "input",
      value: RESOURCE_SITES
    }
  ],
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

  // 获取剧集备注信息（如"已完结"、"更新中"等）
  const vodRemarks = item.vod_remarks || '';
  
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
          // 构建描述信息，包含剧集备注
          let description = `${item.vod_name} - 第${targetEpisode}集`;
          if (vodRemarks) {
            description += ` - ${vodRemarks}`;
          }
          description += ` - [${sourceName}]`;
          
          resources.push({
            name: siteTitle,
            description: description,
            url: url
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
            // 构建描述信息，包含剧集备注
            let description = `${item.vod_name} - 电视剧 - 共${totalEpisodes}集`;
            if (vodRemarks) {
              description += ` - ${vodRemarks}`;
            }
            description += ` - [${sourceName}]`;
            
            resources.push({
              name: siteTitle,
              description: description,
              url: firstM3U8Url
            });
          }
        }
      }
    } else if (type === 'movie' && !isTVSeries) {
      // 电影处理 - 不显示备注信息
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
          
          // 构建描述信息 - 电影不显示备注信息
          const description = `${item.vod_name} - ${qualityText} - [${sourceName}]`;
          
          resources.push({
            name: siteTitle,
            description: description,
            url: url
          });
          // 电影只取第一个M3U8版本
          break;
        }
      }
    }
  }
  
  return resources;
}

/**
 * 改进的parseCSV函数（支持有/无标题行）
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  if (lines.length === 0) return [];
  
  // 检查第一行是否可能是标题行（不包含http）
  const firstLine = lines[0].toLowerCase();
  const hasTitleRow = !firstLine.includes('http://') && !firstLine.includes('https://');
  
  let startIndex = 0;
  let headers = ['title', 'value']; // 默认标题
  
  if (hasTitleRow) {
    headers = lines[0].split(',').map(header => header.trim());
    startIndex = 1;
  }
  
  const result = [];
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i];
    const values = line.split(',').map(value => value.trim());
    const item = {};
    
    for (let j = 0; j < headers.length && j < values.length; j++) {
      const key = headers[j].toLowerCase();
      item[key] = values[j];
    }
    
    // 确保有必要的字段
    if (item.title && item.value) {
      // 确保URL以/结尾（很多苹果CMS API需要）
      if (!item.value.endsWith('/')) {
        item.value = item.value + '/';
      }
      result.push(item);
    } else if (item.name && item.url) {
      // 兼容其他字段名
      result.push({
        title: item.name,
        value: item.url.endsWith('/') ? item.url : item.url + '/'
      });
    }
  }
  
  return result;
}

/**
 * 直接解析CSV格式（不依赖标题行）
 */
function parseCSVDirect(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim() !== '');
  const result = [];
  
  for (const line of lines) {
    const values = line.split(',').map(value => value.trim());
    if (values.length >= 2) {
      // 假设格式为：名称,URL
      const title = values[0];
      const url = values[1];
      
      // 验证URL格式
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        result.push({
          title: title,
          value: url.endsWith('/') ? url : url + '/'
        });
      }
    }
  }
  
  return result;
}

/**
 * 解析VodData参数，获取资源站点列表（支持JSON和CSV格式）
 */
function parseResourceSites(VodData) {
  try {
    // 首先尝试解析JSON格式
    if (VodData && typeof VodData === 'string') {
      // 检查是否是JSON格式（以[或{开头）
      const trimmed = VodData.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const parsed = JSON.parse(VodData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 确保数据结构正确
          return parsed.map(site => ({
            title: site.title || site.name || '未知站点',
            value: site.value || site.url || ''
          })).filter(site => {
            // 过滤无效站点
            const hasTitle = site.title && site.title.trim() !== '';
            const hasValidUrl = site.value && 
              (site.value.startsWith('http://') || site.value.startsWith('https://'));
            return hasTitle && hasValidUrl;
          });
        }
      } else {
        // 尝试解析CSV格式
        const parsed = parseCSV(VodData);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // 过滤无效站点
          return parsed.filter(site => {
            const hasTitle = site.title && site.title.trim() !== '';
            const hasValidUrl = site.value && 
              (site.value.startsWith('http://') || site.value.startsWith('https://'));
            return hasTitle && hasValidUrl;
          });
        } else {
          // 如果解析失败，尝试直接解析默认格式
          const directParsed = parseCSVDirect(VodData);
          if (Array.isArray(directParsed) && directParsed.length > 0) {
            return directParsed;
          }
        }
      }
    }
  } catch (error) {
    // 解析失败，使用默认资源
    console.log('解析VodData失败，使用默认资源:', error);
  }
  
  // 如果VodData无效或解析失败，使用默认资源
  try {
    const defaultSites = parseCSVDirect(RESOURCE_SITES);
    if (defaultSites.length > 0) {
      console.log('使用默认资源站点');
      return defaultSites;
    }
  } catch (error) {
    console.log('默认资源解析失败:', error);
  }
  
  console.log('未找到任何有效资源站点');
  return [];
}

async function loadResource(params) {
  const { seriesName, type, season, episode, multiSource, VodData } = params;
  
  console.log('接收参数:', {
    seriesName,
    type,
    season,
    episode,
    multiSource,
    VodDataLength: VodData?.length || 0
  });
  
  if (multiSource !== "enabled") {
    console.log('聚合搜索已禁用');
    return [];
  }
  
  // 从VodData参数解析资源站点
  const resourceSites = parseResourceSites(VodData);
  
  console.log('解析到的资源站点数量:', resourceSites.length);
  console.log('资源站点详情:', resourceSites.map(site => `${site.title}: ${site.value}`));
  
  if (resourceSites.length === 0) {
    console.log('未找到有效的资源站点');
    return [];
  }
  
  // 解析剧名，获取基础剧名和季数
  const seriesInfo = extractSeasonInfo(seriesName);
  const baseName = seriesInfo.baseName;
  const targetSeason = season ? parseInt(season) : seriesInfo.seasonNumber;
  
  console.log('剧名解析结果:', {
    originalName: seriesName,
    baseName,
    targetSeason,
    seriesInfo
  });
  
  const searchTerm = baseName.trim();
  const resourceType = type || 'tv';
  const targetEpisode = episode ? parseInt(episode) : null;
  
  console.log('搜索参数:', {
    searchTerm,
    resourceType,
    targetEpisode
  });
  
  const allResources = [];
  
  try {
    // 并行请求所有站点
    const requests = resourceSites.map(async (site) => {
      try {
        // 检查站点配置是否正确
        if (!site || !site.value) {
          console.log(`跳过无效站点: ${site?.title || '未知站点'}`);
          return null;
        }
        
        // 确保URL格式正确
        let apiUrl = site.value;
        if (!apiUrl.endsWith('/')) {
          apiUrl += '/';
        }
        
        console.log(`请求站点: ${site.title}, URL: ${apiUrl}`);
        
        const response = await Widget.http.get(apiUrl, {
          params: { ac: "detail", wd: searchTerm },
          timeout: 10000 // 10秒超时
        });
        
        console.log(`站点 ${site.title} 响应状态:`, {
          status: response.status,
          hasData: !!response.data,
          code: response.data?.code,
          listLength: response.data?.list?.length || 0
        });
        
        if (response.data?.code === 1 && response.data.list?.length > 0) {
          return {
            site: site.title || '未知站点',
            data: response.data.list
          };
        } else {
          console.log(`站点 ${site.title} 无搜索结果或响应异常`);
        }
      } catch (error) {
        // 静默处理请求错误
        console.log(`请求站点失败: ${site?.title || '未知站点'}`, {
          error: error.message,
          url: site.value
        });
      }
      return null;
    });
    
    const results = await Promise.all(requests);
    
    console.log('所有站点请求完成，有效结果数量:', results.filter(r => r !== null).length);
    
    // 处理搜索结果
    for (const result of results) {
      if (!result?.data) continue;
      
      console.log(`处理站点 ${result.site} 的数据，数量: ${result.data.length}`);
      
      for (const item of result.data) {
        const itemName = item.vod_name?.trim();
        
        if (!itemName) continue;
        
        // 提取当前剧集的季数信息
        const itemInfo = extractSeasonInfo(itemName);
        
        console.log(`检查剧集: ${itemName}`, {
          itemBaseName: itemInfo.baseName,
          itemSeason: itemInfo.seasonNumber,
          targetBaseName: baseName,
          targetSeason: targetSeason,
          match: itemInfo.baseName === baseName && itemInfo.seasonNumber === targetSeason
        });
        
        // 检查是否匹配：基础剧名相同且季数匹配
        if (itemInfo.baseName !== baseName || itemInfo.seasonNumber !== targetSeason) {
          continue;
        }

        const items = extractPlayInfo(item, result.site, resourceType, targetSeason, targetEpisode);
        console.log(`剧集 ${itemName} 提取到播放信息数量:`, items.length);
        
        if (items.length > 0) {
          allResources.push(...items);
        }
      }
    }
    
    console.log('所有资源提取完成，总数:', allResources.length);
    
    // 去重：根据URL去重，避免同一资源多次返回
    const uniqueResources = [];
    const urlSet = new Set();
    
    for (const resource of allResources) {
      if (resource.url && !urlSet.has(resource.url)) {
        urlSet.add(resource.url);
        uniqueResources.push(resource);
      }
    }
    
    console.log('去重后资源数量:', uniqueResources.length);
    console.log('最终返回资源:', uniqueResources);
    
    return uniqueResources;
    
  } catch (error) {
    console.log('资源加载过程中发生错误:', error);
    return [];
  }
}