const RESOURCE_SITES = `
天涯影视,https://tyyszyapi.com/api.php/provide/vod/
非凡影视,http://ffzy4.tv/api.php/provide/vod/
如意资源站,https://cj.rycjapi.com/api.php/provide/vod/at/json/
量子资源站,https://cj.lziapi.com/api.php/provide/vod/at/json/
爱奇艺资源站,https://iqiyizyapi.com/api.php/provide/vod/
`;

// 缓存中文数字映射，提升匹配性能
const CHINESE_NUM_MAP = {
  '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
  '六': 6, '七': 7, '八': 8, '九': 9, '十': 10
};

WidgetMetadata = {
  id: "vod_stream",
  title: "VOD Stream",
  icon: "https://assets.vvebo.vip/scripts/icon.png",
  version: "1.2.0",
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

// --- 工具函数 ---

const isM3U8Url = (url) => url?.toLowerCase().includes('m3u8') || false;

/**
 * 提取季数信息：支持 "第2季", "第二部", "电影名2" 等格式
 */
function extractSeasonInfo(seriesName) {
  if (!seriesName) return { baseName: seriesName, seasonNumber: 1 };

  const chineseMatch = seriesName.match(/第([一二三四五六七八九十\d]+)[季部]/);
  if (chineseMatch) {
    const val = chineseMatch[1];
    const seasonNum = CHINESE_NUM_MAP[val] || parseInt(val) || 1;
    const baseName = seriesName.replace(/第[一二三四五六七八九十\d]+[季部]/, '').trim();
    return { baseName, seasonNumber: seasonNum };
  }

  const digitMatch = seriesName.match(/(.+?)(\d+)$/);
  if (digitMatch) {
    return { baseName: digitMatch[1].trim(), seasonNumber: parseInt(digitMatch[2]) || 1 };
  }

  return { baseName: seriesName.trim(), seasonNumber: 1 };
}

/**
 * 核心提取逻辑：将 VOD 原始项转换为标准资源对象
 */
function extractPlayInfo(item, siteTitle, type) {
  const { vod_name, vod_play_url, vod_play_from, vod_remarks = '' } = item;
  if (!vod_name || !vod_play_url) return [];

  const playSources = vod_play_url.replace(/#+$/, '').split('$$$');
  const sourceNames = (vod_play_from || '').split('$$$');
  
  return playSources.flatMap((playSource, i) => {
    const sourceName = sourceNames[i] || '默认源';
    const isTV = playSource.includes('#');
    const results = [];

    if (type === 'tv' && isTV) {
      // 提取所有集数，以便全量缓存
      const episodes = playSource.split('#').filter(Boolean);
      episodes.forEach(ep => {
        const [epName, url] = ep.split('$');
        if (url && isM3U8Url(url)) {
          results.push({
            name: siteTitle,
            description: `${vod_name} - ${epName}${vod_remarks ? ' - ' + vod_remarks : ''} - [${sourceName}]`,
            url: url.trim()
          });
        }
      });
    } else if (type === 'movie' && !isTV) {
      // 电影取第一个有效版本
      const versions = playSource.split('#');
      for (const v of versions) {
        const [quality, url] = v.split('$');
        if (url && isM3U8Url(url)) {
          const qualityText = quality.toLowerCase().includes('tc') ? '抢先版' : '正片';
          results.push({
            name: siteTitle,
            description: `${vod_name} - ${qualityText} - [${sourceName}]`,
            url: url.trim()
          });
          break; 
        }
      }
    }
    return results;
  });
}

/**
 * 解析源配置
 */
function parseResourceSites(VodData) {
  const parseLine = (line) => {
    const [title, value] = line.split(',').map(s => s.trim());
    if (title && value?.startsWith('http')) {
      return { title, value: value.endsWith('/') ? value : value + '/' };
    }
    return null;
  };

  try {
    const trimmed = VodData?.trim() || "";
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      return JSON.parse(trimmed)
        .map(s => ({ title: s.title || s.name, value: s.value || s.url }))
        .filter(s => s.title && s.value?.startsWith('http'));
    }
    return trimmed.split('\n').map(parseLine).filter(Boolean);
  } catch (e) {
    return RESOURCE_SITES.trim().split('\n').map(parseLine).filter(Boolean);
  }
}

// --- 主函数 ---

async function loadResource(params) {
  const { seriesName, type = 'tv', season, episode, multiSource, VodData } = params;
  
  if (multiSource !== "enabled" || !seriesName) return [];

  // 1. 初始化参数
  const resourceSites = parseResourceSites(VodData);
  const { baseName, seasonNumber } = extractSeasonInfo(seriesName);
  const targetSeason = season ? parseInt(season) : seasonNumber;
  const targetEpisode = episode ? parseInt(episode) : null;
  const epSuffix = targetEpisode ? `第${targetEpisode}集` : null;

  // 2. 缓存 Key 设计：按 剧名+季数+类型 存储
  const cacheKey = `vod_cache_${baseName}_s${targetSeason}_${type}`;
  
  try {
    const cached = Widget.storage.get(cacheKey);
    if (cached && Array.isArray(cached)) {
      console.log(`[Cache] 命中缓存: ${cacheKey}`);
      return epSuffix 
        ? cached.filter(res => res.description.includes(epSuffix))
        : cached;
    }
  } catch (e) {
    console.error('读取缓存失败', e);
  }

  // 3. 并行抓取数据
  console.log(`[Network] 开始聚合搜索: ${baseName} 第${targetSeason}季`);
  const fetchTasks = resourceSites.map(async (site) => {
    try {
      const response = await Widget.http.get(site.value, {
        params: { ac: "detail", wd: baseName.trim() },
        timeout: 10000 
      });

      const list = response?.data?.list;
      if (!Array.isArray(list)) return [];

      return list.flatMap(item => {
        const itemInfo = extractSeasonInfo(item.vod_name);
        // 严格匹配：基础剧名相同 且 季数相同
        if (itemInfo.baseName !== baseName || itemInfo.seasonNumber !== targetSeason) {
          return [];
        }
        // 提取该剧在该源下的所有集数
        return extractPlayInfo(item, site.title, type);
      });
    } catch (error) {
      console.log(`[Error] 站点 ${site.title} 请求失败: ${error.message}`);
      return [];
    }
  });

  const allResults = (await Promise.all(fetchTasks)).flat();

  // 4. URL 去重
  const seenUrls = new Set();
  const uniqueResources = allResults.filter(res => {
    if (!res.url || seenUrls.has(res.url)) return false;
    seenUrls.add(res.url);
    return true;
  });

  // 5. 存入缓存 (1800秒 = 30分钟)
  if (uniqueResources.length > 0) {
    try {
      Widget.storage.set(cacheKey, uniqueResources, 1800);
      console.log(`[Cache] 已更新全量缓存: ${cacheKey}`);
    } catch (e) {
      console.error('写入缓存失败', e);
    }
  }

  // 6. 最终按需过滤返回
  if (epSuffix && type === 'tv') {
    return uniqueResources.filter(res => res.description.includes(epSuffix));
  }

  return uniqueResources;
}
