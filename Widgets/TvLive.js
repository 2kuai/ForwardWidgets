var WidgetMetadata = {
    id: "tv_live",
    title: "电视台",
    description: "获取热门电视直播频道",
    author: "两块",
    site: "https://github.com/2kuai/ForwardWidgets",
    version: "1.0.0",
    requiredVersion: "0.0.1",
    modules: [
        {
            title: "电视频道",
            description: "热门电视频道",
            requiresWebView: false,
            functionName: "getLiveTv",
            params: [
                {
                    name: "type",
                    title: "类型",
                    type: "enumeration",
                    enumOptions: [
                        { title: "央视", value: "cctv" },
                        { title: "卫视", value: "stv" },
                        { title: "地方", value: "ltv" },
                        { title: "全部", value: "all" }
                    ]
                }
            ]
        }
    ]
};

async function getLiveTv(params = {}) {
    try {
        const response = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/index.json");
        
        if (!response?.data) {
            throw new Error("响应数据为空或格式不正确");
        }

        const modifiedData = { ...response.data };

        const allChannels = Object.values(modifiedData)
            .filter(channels => Array.isArray(channels))
            .flat();

        modifiedData["all"] = allChannels;

        if (!params.type || !modifiedData[params.type]) {
            throw new Error(`不支持的类型: ${params.type}`);
        }
        
        const dataType = modifiedData[params.type];
        
        const items = dataType.map((item) => {
            const childItems = item.childItems?.length > 0 
                ? item.childItems.map((child) => ({
                    id: child.sub_id,
                    type: "url",
                    title: child.name,
                    link: child.sub_id
                }))
                : [];
                
            return {
                id: item.id,
                type: "url",
                title: item.name,
                backdropPath: item.backdrop_path,
                description: item.description,
                link: item.id,
                childItems: childItems
            };
        });
        console.log("直播频道列表:", items);

        return items;
    } catch (error) {
        console.error("获取直播频道失败:", error.message);
        throw error;
    }
}

async function loadDetail(link) {
    let videoUrl = link;
    const formats = ['m3u8', 'mp4', 'mp3', 'flv', 'avi', 'mov', 'wmv', 'webm', 'ogg', 'mkv', 'ts'];
    
    if (!formats.some(format => link.includes(format))) {
        try {
            const response = await Widget.http.get(`https://redirect-check.hxd.ip-ddns.com/redirect-check?url=${link}`);
            if (response.data?.location && formats.some(format => response.data.location.includes(format))) {
                videoUrl = response.data.location;
            }
        } catch (e) {
            console.error('主链接重定向检查失败:', e);
        }
    }

    let childItems = [];
    try {
        const jsonResponse = await Widget.http.get("https://raw.githubusercontent.com/2kuai/ForwardWidgets/refs/heads/main/index.json");
        const jsonData = jsonResponse.data;

        if (typeof jsonData !== 'object' || jsonData === null) {
            throw new Error('Invalid JSON data structure');
        }

        const matchingItem = Object.entries(jsonData)
            .filter(([key]) => key !== 'metadata' && Array.isArray(jsonData[key]))
            .flatMap(([_, items]) => items)
            .find(item => item.id === link);

        if (matchingItem && matchingItem.childItems) {
            childItems = matchingItem.childItems.map(item => ({
                id: item.sub_id,
                type: "url",
                title: matchingItem.name,
                link: item.sub_id,
                backdropPath: matchingItem.backdrop_path
            }));
        }
    } catch (error) {
        console.error('获取子项时出错:', error);
    }

    return {
        id: videoUrl,
        type: "url",
        videoUrl: videoUrl,
        childItems: childItems,
        customHeaders: {
            "Referer": link,
            "User-Agent": "AptvPlayer/1.4.6",
        },
    };
}
