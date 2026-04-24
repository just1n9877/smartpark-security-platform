# 附录：Shanghai 类数据集接入说明

一、这份文档解决什么问题

很多校园异常检测数据是“帧序列 + 索引 + 标签（`.npy`）”格式，而本项目主流程吃的是 `.mp4`。这份文档就是把这两者接起来，同时保证对外口径真实不误导。

---

二、数据来源怎么写才合规

1. 如果数据来自 ShanghaiTech Campus（或同类公开数据），答辩材料必须写清正式名称、论文信息和下载来源。  
2. 许可范围以随包 LICENSE 为准，不能自己猜。  
3. 公开数据片段做演示时，应写“用于算法/流水线验证”，不能和“甲方园区实拍”混称。  

---

三、常见目录说明（以 `SHANGHAI_Test` 为例）

| 路径/文件 | 含义 |
|------|------|
| `SHANGHAI_test.txt` | 片段索引，通常含片段路径、帧数、异常标记、异常区间 |
| `frames/` | 每个片段对应一组有序图像 |
| `label/` | 帧级标签（`.npy`），通常用于离线评估 |

实际字段以你拿到的数据说明文档为准。

---

四、和当前流水线如何衔接

当前接口 `POST /jobs/run_local_path` 只接受视频文件路径。也就是说：

- 可以传 `.mp4`
- 不能直接传 `frames/某目录`
- 也不会直接读取 `.npy` 作为在线告警输入

### 推荐做法：先把帧序列转 mp4

1. 从索引里选一个片段，定位到对应 `frames` 子目录。  
2. 用 `ffmpeg` 转成视频，比如 `data/videos/demo_shanghai.mp4`。  
3. 按 `TESTING.md` 的步骤调用 `POST /jobs/run_local_path` 跑任务。  

路径示例：

- 本机：`C:/.../smartpark-security-platform/data/videos/demo_shanghai.mp4`
- Docker：`/app/data/videos/demo_shanghai.mp4`

示例命令：

```bash
ffmpeg -framerate 25 -i frame_%06d.jpg -c:v libx264 -pix_fmt yuv420p demo_shanghai.mp4
```

### `.npy` 当前怎么用

- 当前后端没有实现“`.npy` 直接驱动告警”
- 你可以把 `.npy` 用在离线评估，对照轨迹/告警结果
- 文档中应写“可选离线评估”，不要写“系统已自动对齐 GT”

---

五、演示口径建议

- 可以说：我们用 ShanghaiTech Campus 的公开片段转成 mp4 做了轨迹和告警流程验证。  
- 不要说：这是园区实拍行人数据。  
- 要区分：RepCount/LLSP 是健身先验，Shanghai 是校园监控场景公开数据。  

---

六、工程落地建议

- 原始大数据建议放 `data/external/shanghai_test/`，不要整包进 Git
- 只提交必要的小体积样例视频和说明文件
- 和 `README.md`、`TESTING.md` 的口径保持一致

---

七、写文档时的底线

- 不编造论文名、年份、授权条款
- 没有实现的能力不要写成“已支持”
- 对 `.npy` 的能力描述必须和代码现状一致
