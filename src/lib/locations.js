// 统一管理官方地点列表与别名映射
// 新增地点时在这里同时维护，避免两处不同步

export const POPULAR_LOCATIONS = [
    'All Locations',
    'Ryan & Miho',
    'Jaya One',
    'Pacific Tower',
    'Seventeen Residence',
    'PJ Midtown',
    'South Link',
    'Southview',
    'KL Gateway',
    '线上'
]

// 搜索别名映射：用户输入的简称 → 官方地点名称
export const LOCATION_ALIASES = {
    'ryan': 'Ryan & Miho',
    'miho': 'Ryan & Miho',
    'jaya': 'Jaya One',
    'pacific': 'Pacific Tower',
    'seventeen': 'Seventeen Residence',
    '17': 'Seventeen Residence',
    'midtown': 'PJ Midtown',
    'pj': 'PJ Midtown',
    'south link': 'South Link',
    'southlink': 'South Link',
    'southview': 'Southview',
    'south view': 'Southview',
    'kl gateway': 'KL Gateway',
    'gateway': 'KL Gateway',
    'um library': 'UM Library',
    'library': 'UM Library',
    '线上': '线上',
    'online': '线上'
}
