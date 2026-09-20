# 赴约：可安装的手机端 PWA

运行 `node preview.cjs` 后访问 http://localhost:8765。本地预览服务器仅监听本机。Service Worker 不会在直接双击 `index.html` 时启用。

## PWA

- 包含 Web App Manifest、主屏图标、独立显示模式和离线缓存。
- iPhone 使用 Safari 的“分享 → 添加到主屏幕”安装。安装入口会在页面中显示操作提示。
- PWA 必须通过 HTTPS 发布；`localhost` 仅用于本机开发。
- 当前数据保存在安装该 PWA 的设备中。清除网站数据、卸载 PWA或更换手机都可能丢失数据，正式使用前应增加导出备份或云同步。

## 本轮更新

- 城市足迹使用本地省级行政区 GeoJSON 底图，支持全国、足迹区域两种视野。
- 仅已到场活动点亮城市；城市按钮可切换当地现场记录。未包含坐标的城市保留记录并提示待定位。
- 手机优先布局：安全区留白、底部导航、横向艺人卡片、底部表单、16px 输入字号、城市按钮至少 44px 高。
- 浏览器中检查了 320px、390px 窄屏地图和 320px 表单，未发现页面横向溢出。尚未进行真实 iPhone Safari 或微信真机测试。

## 地图来源

阿里云 DataV GeoAtlas：https://datav.aliyun.com/portal/school/atlas/area_selector

原始数据：https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json

下载日期：2026-09-20。`china-provinces.geojson` 为原始数据，`china-provinces.js` 为直接本地加载的副本。当前使用简化经纬度投影展示，不是道路导航地图。

## 小程序落地边界

目前为 HTML/CSS/JavaScript 原型，并非已发布的小程序。后续落地需使用目标小程序平台的页面、地图、图片选择、持久化及安全区接口替换网页实现；微信版本应处理右上角胶囊区域，并在开发者工具及 iPhone 微信真机上验证键盘、图片上传与地图手势。

订单导入仍为固定示例数据，未接入真实 OCR 或购票账号。个人数据目前仅保存在当前浏览器。

验证命令：`node check-map.cjs`。
