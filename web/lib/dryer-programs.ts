export type DryerProgramParameter = {
  property: "temperature_level" | "dry_level" | "dry_temp" | "crease_resist_old" | "dry_time_new";
  name: string;
  values: Array<{ value: number; label: string }>;
  defaultIndex: number;
  description?: string;
};

export type DryerProgram = {
  value: number;
  name: string;
  group: "日常程序" | "特定材质" | "DIY";
  minutes: number;
  description: string;
  icon: "mixed" | "large" | "small" | "timed" | "warm" | "air" | "quick" | "fresh" | "sanitize" | "rack" | "bedding" | "wool" | "down" | "cotton" | "baby" | "shirt" | "towel" | "underwear" | "sport" | "denim";
  parameters: DryerProgramParameter[];
  optional?: boolean;
};

const temperature = (defaultIndex = 0): DryerProgramParameter => ({ property: "temperature_level", name: "温度", values: [1, 2, 3].map((value, index) => ({ value, label: ["L1（低）", "L2", "L3（高）"][index] })), defaultIndex });
const dryness = (values = [1, 2, 3], defaultIndex = values.includes(1) ? 1 : 0): DryerProgramParameter => ({ property: "dry_level", name: "烘干度", values: values.map((value) => ({ value, label: ({ 1: "即熨", 2: "即穿", 3: "储藏" } as Record<number, string>)[value] })), defaultIndex, description: "用于调整衣物的烘干程度。" });
const sanitize = (values = [0, 1], labels = ["关闭", "开启"], defaultIndex = 0): DryerProgramParameter => ({ property: "dry_temp", name: "多维除菌", values: values.map((value, index) => ({ value, label: labels[index] })), defaultIndex, description: "烘干过程中对衣物进行除菌处理；轻薄、精细材质衣物慎用。" });
const crease: DryerProgramParameter = { property: "crease_resist_old", name: "智能防皱", values: [{ value: 0, label: "关闭" }, { value: 1, label: "开启" }], defaultIndex: 0, description: "程序结束后间歇运转，减少衣物因未及时取出而产生的褶皱。" };
const time = (values: number[], defaultIndex: number): DryerProgramParameter => ({ property: "dry_time_new", name: "时间", values: values.map((value) => ({ value, label: `${value} 分钟` })), defaultIndex });
const standard = (drynessValues = [1, 2, 3], dryDefault?: number, temperatureDefault = 0): DryerProgramParameter[] => [temperature(temperatureDefault), dryness(drynessValues, dryDefault), sanitize(), crease];

// Runtime-verified from the authorized target device plug-in configuration.
// `optional` entries are the plug-in's cycle-shop programs, not enabled by default.
export const DRYER_PROGRAMS: DryerProgram[] = [
  { value: 2, name: "混合", group: "日常程序", minutes: 100, description: "可用于烘干棉质类与合成织物混纺的织物。", icon: "mixed", parameters: standard() },
  { value: 43, name: "大件烘", group: "日常程序", minutes: 150, description: "适用四件套等大件烘干。", icon: "large", parameters: [temperature(), dryness([2, 3], 0), sanitize([0, 1], ["关闭", "1档（快速除菌）"]), crease] },
  { value: 42, name: "小件烘", group: "日常程序", minutes: 50, description: "适用少量衣物快速烘干。", icon: "small", parameters: [dryness([2, 3], 0), sanitize(), crease] },
  { value: 45, name: "晒被子", group: "日常程序", minutes: 45, description: "对长期存放的薄被子进行除潮祛味处理。", icon: "bedding", parameters: [sanitize()] },
  { value: 39, name: "空气洗", group: "日常程序", minutes: 20, description: "清新祛味，焕新衣物。", icon: "air", parameters: [time([0, 5, 10, 15, 20, 25], 3)] },
  { value: 83, name: "除菌除螨", group: "日常程序", minutes: 180, description: "对长期存放的衣物进行除菌除螨处理。", icon: "sanitize", parameters: [sanitize([1, 2, 3], ["1档（快速除菌）", "2档（日常除菌）", "3档（深度除菌）"], 1)] },
  { value: 11, name: "热风暖衣", group: "日常程序", minutes: 30, description: "对需要穿着使用的衣物加热温暖。", icon: "warm", parameters: [time([0, 10, 20, 30, 40, 50], 2)] },
  { value: 26, name: "定时烘", group: "日常程序", minutes: 30, description: "自定义烘干时间，到时即停。", icon: "timed", parameters: [time(Array.from({ length: 18 }, (_, index) => index * 10), 2)] },
  { value: 17, name: "快烘", group: "日常程序", minutes: 30, description: "适用少量轻薄衣物快速烘干。", icon: "quick", parameters: [] },
  { value: 10, name: "冷风清新", group: "日常程序", minutes: 20, description: "使用冷风帮助衣物清新。", icon: "fresh", parameters: [time([0, 10, 20], 1)], optional: true },
  { value: 28, name: "支架烘", group: "日常程序", minutes: 20, description: "衣物置于支架上平铺烘干。", icon: "rack", parameters: [temperature(), time(Array.from({ length: 17 }, (_, index) => index * 10), 0)], optional: true },
  { value: 8, name: "羊毛", group: "日常程序", minutes: 180, description: "适用于可机洗羊毛类衣物的辅助烘干。", icon: "wool", parameters: [time([0, 60], 0)], optional: true },
  { value: 6, name: "羽绒服", group: "特定材质", minutes: 150, description: "羽绒服衣物脱水后烘干。", icon: "down", parameters: [time([0, 30, 60, 90], 0)] },
  { value: 44, name: "羊毛护理", group: "特定材质", minutes: 25, description: "专业羊毛护理程序，参数由设备自动设定。", icon: "wool", parameters: [] },
  { value: 14, name: "婴儿服", group: "特定材质", minutes: 90, description: "适用棉麻类婴童衣物烘干。", icon: "baby", parameters: standard([2, 3], 0) },
  { value: 22, name: "浴巾", group: "特定材质", minutes: 95, description: "适用于烘干浴巾。", icon: "towel", parameters: standard([2, 3], 0) },
  { value: 15, name: "衬衫", group: "特定材质", minutes: 50, description: "适用混纺类衬衫烘干。", icon: "shirt", parameters: [temperature(), dryness([1, 2, 3], 1), sanitize([0, 1], ["关闭", "1档（快速除菌）"]), crease] },
  { value: 0, name: "棉麻", group: "特定材质", minutes: 110, description: "适用棉麻类衣物烘干。", icon: "cotton", parameters: standard([1, 2, 3], 1, 2), optional: true },
  { value: 13, name: "内衣", group: "特定材质", minutes: 100, description: "适用内衣等小件衣物烘干。", icon: "underwear", parameters: standard([2, 3], 0), optional: true },
  { value: 12, name: "运动服", group: "特定材质", minutes: 115, description: "适用合成面料运动服烘干。", icon: "sport", parameters: standard([2, 3], 0), optional: true },
  { value: 3, name: "牛仔", group: "特定材质", minutes: 160, description: "适用牛仔类衣物烘干。", icon: "denim", parameters: standard([2, 3], 0), optional: true },
];

export const DRYER_PROGRAM_IDS = new Set(DRYER_PROGRAMS.map(({ value }) => value));
