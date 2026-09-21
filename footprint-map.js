// Offline city-coordinate map. Unknown cities remain visible below the map.
const cityCoordinates = {
  '北京':[116.41,39.90],'天津':[117.20,39.08],'上海':[121.47,31.23],
  '南京':[118.80,32.06],'杭州':[120.16,30.27],'嘉兴':[120.76,30.75],
  '苏州':[120.59,31.30],'宁波':[121.55,29.87],'无锡':[120.31,31.49],
  '合肥':[117.23,31.82],
  '济南':[117.12,36.65],'青岛':[120.38,36.07],'郑州':[113.63,34.75],
  '武汉':[114.31,30.59],'长沙':[112.94,28.23],'南昌':[115.86,28.68],
  '福州':[119.30,26.08],'厦门':[118.09,24.48],'广州':[113.26,23.13],
  '深圳':[114.06,22.54],'珠海':[113.58,22.27],'南宁':[108.37,22.82],
  '海口':[110.20,20.04],'成都':[104.07,30.57],'重庆':[106.55,29.56],
  '昆明':[102.83,24.88],'贵阳':[106.63,26.65],'西安':[108.94,34.34],
  '太原':[112.55,37.87],'石家庄':[114.51,38.04],'沈阳':[123.43,41.81],
  '大连':[121.61,38.91],'长春':[125.32,43.82],'哈尔滨':[126.64,45.76],
  '兰州':[103.83,36.06],'西宁':[101.78,36.62],'银川':[106.23,38.49],
  '呼和浩特':[111.75,40.84],'乌鲁木齐':[87.62,43.83],'拉萨':[91.14,29.65],
  '香港':[114.17,22.32],'澳门':[113.54,22.20],'台北':[121.57,25.03]
};
const normalizeCity = value => {
  const name=value.trim(), short=name.replace(/市$/, '');
  return cityCoordinates[short] ? short : name;
};
let activeMapCity = null;
let mapView = 'country';
let mapZoom = 1;
function footprintMap(events) {
  const groups = new Map();
  events.filter(e => e.status === 'attended').forEach(e => {
    const city = normalizeCity(e.city);
    if (!groups.has(city)) groups.set(city, []);
    groups.get(city).push(e);
  });
  const cities = [...groups.keys()];
  const known = cities.filter(c => cityCoordinates[c]);
  const unknown = cities.filter(c => !cityCoordinates[c]);
  if (!groups.has(activeMapCity)) activeMapCity = known[0] || cities[0] || null;
  // Fit visited cities with generous padding; nearby cities stay individually selectable.
  const coords = known.map(c => cityCoordinates[c]);
  const focus = mapView === 'visited' && coords.length;
  const minLon = focus ? Math.min(...coords.map(c=>c[0])) : 73;
  const maxLon = focus ? Math.max(...coords.map(c=>c[0])) : 135;
  const minLat = focus ? Math.min(...coords.map(c=>c[1])) : 3;
  const maxLat = focus ? Math.max(...coords.map(c=>c[1])) : 54;
  const zoomCenter = mapZoom > 1 && cityCoordinates[activeMapCity];
  const midLon = zoomCenter ? zoomCenter[0] : (minLon+maxLon)/2, midLat = zoomCenter ? zoomCenter[1] : (minLat+maxLat)/2;
  const lonSpan = Math.max(8,(maxLon-minLon)*1.15,(maxLat-minLat)*1.15)/mapZoom;
  const latSpan = lonSpan;
  const project = ([lon,lat]) => [360+(lon-midLon)/lonSpan*660,310-(lat-midLat)/latSpan*570];
  const provinces = chinaProvinces.features.map(feature => {
    const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    const path = polygons.map(polygon => polygon.map(ring => ring.map((coord,i) => {
      const [x,y]=project(coord);return `${i?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join('')+'Z').join('')).join('');
    return `<path d="${path}" fill="#252f3b" fill-rule="evenodd" stroke="#697886" stroke-width=".65" vector-effect="non-scaling-stroke"><title>${esc(feature.properties.name||'海域界线')}</title></path>`;
  }).join('');
  const dots = Object.entries(cityCoordinates).map(([city, coord]) => {
    const [x,y]=project(coord);
    if(x<20||x>700||y<20||y>600)return '';
    if(!groups.has(city))return `<circle cx="${x}" cy="${y}" r="3" fill="#535767"/>`;
    const count=groups.get(city).length, chosen=city===activeMapCity;
    return `<g><circle cx="${x}" cy="${y}" r="${chosen?24:17}" fill="#d7fb83" opacity=".12"/><circle cx="${x}" cy="${y}" r="${chosen?13:10}" fill="none" stroke="#d7fb83" opacity=".65"/><circle cx="${x}" cy="${y}" r="5" fill="#d7fb83"/>${chosen?`<text x="${x-16}" y="${y-24}" text-anchor="end" fill="#f2f5e9" font-size="22" paint-order="stroke" stroke="#151a22" stroke-width="5">${esc(city)} · ${count} 场</text>`:''}<foreignObject x="${x-22}" y="${y-22}" width="44" height="44"><button xmlns="http://www.w3.org/1999/xhtml" class="map-hit" data-map-city="${esc(city)}" aria-label="${esc(city)}，${count} 场现场" aria-pressed="${chosen}"></button></foreignObject></g>`;
  }).join('');
  return `<section class="map-card"><div class="map-heading"><div><div class="eyebrow">LIGHT UP YOUR MEMORIES</div><h2>每到一城，点亮一处。</h2></div><span class="tag">已点亮 ${known.length} 座城市</span></div><div class="map-tools" aria-label="地图视野"><button data-map-view="country" aria-pressed="${mapView==='country'}">全国</button><button data-map-view="visited" aria-pressed="${mapView==='visited'}">足迹区域</button></div><div class="map-zoom" aria-label="地图缩放"><button data-map-zoom="out" aria-label="缩小地图" ${mapZoom===1?'disabled':''}>−</button><output aria-live="polite">${mapZoom}×</output><button data-map-zoom="in" aria-label="放大地图" ${mapZoom===8?'disabled':''}>＋</button><button data-map-zoom="reset">重置</button><span>围绕所选城市缩放</span></div><div class="map-surface"><svg viewBox="0 0 720 620" role="group" aria-label="省级行政区底图，亮点为已到场城市"><defs><pattern id="map-grid" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M60 0H0V60" fill="none" stroke="#ffffff" stroke-opacity=".055"/></pattern><radialGradient id="map-light"><stop stop-color="#465743" stop-opacity=".22"/><stop offset="1" stop-color="#14171f" stop-opacity="0"/></radialGradient></defs><rect width="720" height="620" fill="url(#map-grid)"/><ellipse cx="450" cy="240" rx="400" ry="220" fill="url(#map-light)"/><text x="28" y="35" fill="#888e9d" font-size="11" letter-spacing="3">N ↑</text>${provinces}${dots}<text x="28" y="600" fill="#888e9d" font-size="11">${known.length?'点击亮点，重温这一城的现场':'记录一场已到场活动，点亮第一座城市'}</text></svg></div><div class="map-bottom"><span><i></i> 已赴现场</span><span>省级行政区底图 · <a href="https://datav.aliyun.com/portal/school/atlas/area_selector" target="_blank" rel="noopener">DataV GeoAtlas</a></span></div></section><div class="map-cities" aria-label="选择城市">${cities.map(c=>`<button class="pill ${c===activeMapCity?'chosen':''}" data-map-city="${esc(c)}" aria-pressed="${c===activeMapCity}">${esc(c)} <span>${groups.get(c).length} 场</span>${cityCoordinates[c]?'':' · 待定位'}</button>`).join('')}</div>${unknown.length?'<p class="note">待定位城市的记录已保留，暂未在地图中标点。</p>':''}<div aria-live="polite">${activeMapCity?`<div class="section-head"><h2>${esc(activeMapCity)} · 现场回忆</h2><span class="muted">${groups.get(activeMapCity).length} 场已赴约</span></div>${rows(groups.get(activeMapCity))}`:'<p class="empty">你的第一束现场灯光，等你点亮。</p>'}</div>`;
}
document.addEventListener('click', event => {
  const zoomButton=event.target.closest('[data-map-zoom]');
  if(zoomButton){
    const action=zoomButton.dataset.mapZoom;
    mapZoom=action==='reset'?1:Math.max(1,Math.min(8,mapZoom*(action==='in'?2:.5)));
    render();
    document.querySelector(`[data-map-zoom="${action}"]`)?.focus({preventScroll:true});
    return;
  }
  const viewButton=event.target.closest('[data-map-view]');
  if(viewButton){mapView=viewButton.dataset.mapView;mapZoom=1;render();document.querySelector(`[data-map-view="${mapView}"]`)?.focus({preventScroll:true});return;}
  const button=event.target.closest('[data-map-city]');
  if(!button)return;
  activeMapCity=button.dataset.mapCity;
  const buttons=[...document.querySelectorAll('[data-map-city]')];
  const index=buttons.indexOf(button);
  render();
  const next=[...document.querySelectorAll('[data-map-city]')][index];
  if(next)next.focus({preventScroll:true});
});
