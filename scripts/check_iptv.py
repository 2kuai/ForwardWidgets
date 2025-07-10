#!/usr/bin/env python3
import json
import os
import subprocess
import concurrent.futures
from datetime import datetime
import logging
import requests

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

def check_source(source_url):
    """检查单个源的有效性（优化版）"""
    try:
        # 协议检查
        if not source_url.startswith(('http://', 'https://', 'rtmp://')):
            return False, "无效的协议"

        # 第一阶段：快速HTTP检查（仅适用于HTTP协议）
        if source_url.startswith(('http://', 'https://')):
            # 使用curl获取前1KB数据检查签名
            curl_cmd = [
                'curl', '-s', '-r', '0-1024',
                '--connect-timeout', '3',
                '--max-time', '5',
                source_url
            ]
            curl_result = subprocess.run(
                curl_cmd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE
            )
            
            if curl_result.returncode != 0:
                return False, "连接失败"
                
            # 检查常见流媒体签名
            content = curl_result.stdout
            if not any(sig in content for sig in [b'#EXTM3U', b'FLV', b'ftyp']):
                return False, "无效的流媒体格式"

        # 第二阶段：快速流验证（所有协议）
        if source_url.startswith('rtmp://'):
            probe_cmd = [
                'ffprobe', '-v', 'error',
                '-rw_timeout', '5000000',  # 5秒超时
                '-select_streams', 'v:0',
                '-show_entries', 'format=duration',
                '-of', 'csv=print_section=0',
                source_url
            ]
        else:
            probe_cmd = [
                'ffprobe', '-v', 'error',
                '-timeout', '5000000',  # 5秒超时(微秒)
                '-select_streams', 'v:0',
                '-show_entries', 'stream=codec_name',
                '-of', 'csv=print_section=0',
                source_url
            ]
            
        probe_result = subprocess.run(
            probe_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=5  # 双重超时保护
        )
        
        if probe_result.returncode == 0:
            return True, "检测通过"
        else:
            return False, "流验证失败"
            
    except subprocess.TimeoutExpired:
        return False, "检测超时"
    except Exception as e:
        return False, f"检测异常: {str(e)}"

def process_channel(channel, max_workers=10):
    """处理单个频道及其所有源（优化线程池使用）"""
    if 'childItems' not in channel or not channel['childItems']:
        return channel
        
    valid_sources = []
    futures = []
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as executor:
        # 提交所有检测任务
        for source in channel['childItems']:
            if 'url' not in source:
                continue
            futures.append(executor.submit(check_source, source['url']))
        
        # 收集结果
        for i, future in enumerate(concurrent.futures.as_completed(futures)):
            source = channel['childItems'][i]
            is_valid, message = future.result()
            
            if is_valid:
                valid_sources.append(source)
                logger.debug(f"有效源: {source['url']}")
            else:
                logger.info(f"无效源: {source['url']} - 原因: {message}")
    
    channel['childItems'] = valid_sources
    return channel

def main(input_file, output_file, max_workers=10):
    """主函数（添加内存优化）"""
    logger.info("开始IPTV源检测")
    
    # 检查依赖工具
    required_tools = ['curl', 'ffmpeg', 'ffprobe']
    missing_tools = []
    for tool in required_tools:
        try:
            subprocess.run([tool, '-version'], check=True, 
                          stdout=subprocess.DEVNULL, 
                          stderr=subprocess.DEVNULL)
            logger.info(f"{tool} 检测通过")
        except (subprocess.CalledProcessError, FileNotFoundError):
            missing_tools.append(tool)
    
    if missing_tools:
        logger.error(f"错误: 缺少必要工具 {', '.join(missing_tools)}")
        return
    
    # 读取输入文件（使用更高效的方式）
    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        logger.info(f"成功读取输入文件: {input_file}")
    except Exception as e:
        logger.error(f"读取输入文件失败: {str(e)}")
        return
    
    # 更新元数据
    data['last_updated'] = datetime.now().isoformat()
    data['stats'] = {
        'total_channels': 0,
        'valid_sources': 0
    }
    
    # 处理所有频道（显示进度）
    for category in data:
        if isinstance(data[category], list):
            count = len(data[category])
            logger.info(f"处理分类: {category} (共 {count} 个频道)")
            
            data[category] = [process_channel(channel, max_workers) 
                            for channel in data[category]]
            
            valid_count = sum(len(c['childItems']) for c in data[category] 
                             if 'childItems' in c)
            data['stats']['total_channels'] += count
            data['stats']['valid_sources'] += valid_count
            
            logger.info(f"分类 {category} 完成 - 有效源: {valid_count}/{count}")
    
    # 保存结果（原子写入）
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    temp_file = output_file + '.tmp'
    
    try:
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        os.replace(temp_file, output_file)
        logger.info(f"检测完成 - 总计: {data['stats']['total_channels']} 频道, "
                   f"{data['stats']['valid_sources']} 有效源")
    except Exception as e:
        logger.error(f"保存结果失败: {str(e)}")
        if os.path.exists(temp_file):
            os.unlink(temp_file)

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser()
    parser.add_argument('-i', '--input', default='iptv_sources.json',
                      help='输入JSON文件路径')
    parser.add_argument('-o', '--output', default='data/iptv_data.json',
                      help='输出JSON文件路径')
    parser.add_argument('-w', '--workers', type=int, default=20,
                      help='并发工作线程数')
    
    args = parser.parse_args()
    
    main(args.input, args.output, args.workers)
