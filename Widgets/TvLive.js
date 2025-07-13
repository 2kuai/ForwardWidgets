var WidgetMetadata = {
    id: "tv_live",
    title: "电视台",
    description: "获取热门电视直播频道",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.1.4",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "电视频道",
            description: "热门电视频道",
            requiresWebView: false,
            functionName: "getLiveTv",
            params: [
                {
                    name: "sort_by",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "全部频道", value: "all" },
                        { title: "央视频道", value: "cctv" },
                        { title: "卫视频道", value: "stv" },
                        { title: "地方频道", value: "ltv" }
                    ]
                },
                {
                    name: "url",
                    title: "用户订阅",
                    type: "input",
                    description: "输入M3U格式订阅链接"
                },
                {
                    name: "bg_color",
                    title: "台标背景色",
                    type: "input",
                    description: "支持RGB颜色，如DCDCDC",
                    placeholders: [
                        { title: "雾霾灰", value: "90A4AE" },
                        { title: "暖灰色", value: "424242" },
                        { title: "深灰色", value: "1C1C1E" }
                    ]
                }
            ]
        }
    ]
};

async function getLiveTv(params = {}) {
    try {
        // 获取固定订阅数据
        const response = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/data/iptv-data.json");
        
        if (!response?.data) {
            throw new Error("响应数据为空或格式不正确");
        }

        const modifiedData = { ...response.data };
        let addedSourcesCount = 0;
        const usedUserUrls = new Set(); // 记录已使用的用户源URL

        // 处理用户订阅
        if (params.url) {
            try {
                const userResponse = await Widget.http.get(params.url);
                if (userResponse?.data) {
                    const userChannels = parseM3U(userResponse.data);
                    console.log(`[用户订阅] 从用户订阅中解析出 ${userChannels.length} 个频道`);
                    
                    // 先收集所有可能的匹配
                    const allPotentialMatches = [];
                    
                    // 遍历所有基础频道
                    for (const category in modifiedData) {
                        if (Array.isArray(modifiedData[category])) {
                            modifiedData[category].forEach(baseChannel => {
                                // 为每个基础频道查找所有可能的用户频道匹配
                                userChannels.forEach(userChannel => {
                                    if (!usedUserUrls.has(userChannel.url)) {
                                        const score = calculateMatchScore(userChannel.name, baseChannel.name);
                                        if (score > 0.7) {
                                            allPotentialMatches.push({
                                                baseChannel,
                                                userChannel,
                                                score
                                            });
                                        }
                                    }
                                });
                            });
                        }
                    }
                    
                    // 按匹配分数降序排序
                    allPotentialMatches.sort((a, b) => b.score - a.score);
                    
                    // 应用匹配结果
                    const channelStats = {}; // 记录每个频道的添加情况
                    allPotentialMatches.forEach(({ baseChannel, userChannel }) => {
                        if (!usedUserUrls.has(userChannel.url)) {
                            const targetChannel = findChannelInData(modifiedData, baseChannel.name);
                            if (targetChannel) {
                                targetChannel.childItems = [
                                    ...(targetChannel.childItems || []),
                                    userChannel.url
                                ].filter(Boolean);
                                usedUserUrls.add(userChannel.url);
                                addedSourcesCount++;
                                
                                // 记录统计信息
                                if (!channelStats[baseChannel.name]) {
                                    channelStats[baseChannel.name] = {
                                        count: 0,
                                        urls: []
                                    };
                                }
                                channelStats[baseChannel.name].count++;
                                channelStats[baseChannel.name].urls.push(userChannel.url);
                            }
                        }
                    });
                    
                    // 输出详细的频道添加日志
                    console.log(`[用户订阅] 共添加了 ${addedSourcesCount} 个有效源`);
                    for (const [channelName, stats] of Object.entries(channelStats)) {
                        console.log(`  - ${channelName}: 添加了 ${stats.count} 个源`);
                        stats.urls.forEach((url, index) => {
                            console.log(`    ${index + 1}. ${url}`);
                        });
                    }
                }
            } catch (userError) {
                console.error("[用户订阅] 处理用户订阅失败:", userError.message);
            }
        }

        // 合并所有频道到"all"分类
        modifiedData["all"] = Object.values(modifiedData)
            .filter(Array.isArray)
            .flat();

        // 检查请求分类
        if (!params.sort_by || !modifiedData[params.sort_by]) {
            throw new Error(`不支持的类型: ${params.sort_by}`);
        }
        
        // 构建返回数据
        return modifiedData[params.sort_by]
            .map(item => {
                const validUrls = (item.childItems || [])
                    .filter(url => typeof url === 'string' && url.trim());
                
                if (validUrls.length === 0) return null;

                const createItem = (url, title, isMain = false) => ({
                    id: url,
                    type: "url",
                    title: isMain ? item.name : title,
                    backdropPath: item.backdrop_path.replace(/bg-\w{6}/g, params.bg_color ? `bg-${params.bg_color}` : '$&'),
                    description: item.description,
                    videoUrl: url
                });

                const mainItem = createItem(validUrls[0], item.name, true);
                
                if (validUrls.length > 1) {
                    mainItem.childItems = validUrls.slice(1).map((url, i) => 
                        createItem(url, `${item.name} - (${i+1})`)
                    );
                }
                
                return mainItem;
            })
            .filter(Boolean);
            
    } catch (error) {
        console.error("获取直播频道失败:", error.message);
        throw error;
    }
}

// ====================== 核心匹配函数 ======================
/**
 * 计算匹配分数（0-1）
 */
function calculateMatchScore(userName, baseName) {
    // 标准化处理
    const normalize = (name) => {
        return (name || '')
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/-/g, '')
            .replace(/[^\w\u4e00-\u9fa5]/g, '');
    };

    const userNorm = normalize(userName);
    const baseNorm = normalize(baseName);

    // 1. 完全匹配
    if (userNorm === baseNorm) return 1.0;

    // 2. CCTV数字频道精确匹配
    const cctvPattern = /cctv(\d+)/;
    const userMatch = userNorm.match(cctvPattern);
    const baseMatch = baseNorm.match(cctvPattern);
    
    if (userMatch && baseMatch) {
        return userMatch[1] === baseMatch[1] ? 0.9 : 0;
    }

    // 3. 非CCTV频道相似度匹配
    return calculateSimilarity(userNorm, baseNorm);
}

/**
 * 计算相似度（0-1）
 */
function calculateSimilarity(a, b) {
    const matrix = [];
    for (let i = 0; i <= a.length; i++) matrix[i] = [i];
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i-1] === b[j-1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i-1][j] + 1,
                matrix[i][j-1] + 1,
                matrix[i-1][j-1] + cost
            );
        }
    }
    return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

/**
 * 在数据中查找指定频道
 */
function findChannelInData(data, channelName) {
    for (const category in data) {
        if (Array.isArray(data[category])) {
            const found = data[category].find(item => item.name === channelName);
            if (found) return found;
        }
    }
    return null;
}

// ====================== M3U解析器 ======================
function parseM3U(content) {
    const channels = [];
    let current = {};
    let lineIndex = 0;

    content.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;

        // 处理单行格式（如 "CCTV-1,http://example.com"）
        if (line.includes(',http') && !line.startsWith('#')) {
            const [name, url] = line.split(',http');
            channels.push({
                name: name.trim(),
                url: 'http' + url.trim()
            });
            return;
        }

        // 标准EXTINF格式处理
        if (line.startsWith('#EXTINF')) {
            current.name = line.match(/tvg-name="([^"]+)"/)?.[1] || 
                         line.match(/,([^,]+)$/)?.[1]?.trim() || '';
            lineIndex = 1;
        } else if (lineIndex === 1) {
            current.url = line;
            channels.push(current);
            current = {};
            lineIndex = 0;
        }
    });

    return channels;
}
