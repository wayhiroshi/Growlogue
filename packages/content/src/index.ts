export const britishGentlemanWorld = {
  id: "world-british-gentleman",
  slug: "british-gentleman",
  name: "英国紳士",
  description: "日々の鍛錬と教養を、執事とともに積み重ねる世界。",
  xpLabel: "Gentleman XP",
  character: {
    id: "character-butler-alistair",
    name: "Lucien（ルシアン）",
    personality: "面倒だが憎めない、決して見捨てない執事"
  }
} as const;

export const categories = [
  { id: "category-body", key: "strength", name: "身体", statusName: "Strength", icon: "⚔️" },
  { id: "category-writing", key: "writing", name: "執筆", statusName: "Writing", icon: "✒️" },
  { id: "category-knowledge", key: "knowledge", name: "教養", statusName: "Knowledge", icon: "📚" },
  { id: "category-art", key: "art", name: "芸術", statusName: "Art", icon: "🎹" },
  { id: "category-health", key: "health", name: "健康", statusName: "Health", icon: "🌿" }
] as const;

export const habitTemplates = [
  {
    id: "template-strength",
    categoryId: "category-body",
    title: "筋トレ10分",
    worldTitle: "剣術の鍛錬",
    minimumRule: "スクワット10回でも達成",
    baseXp: 10,
    preferredOrder: 10
  },
  {
    id: "template-writing",
    categoryId: "category-writing",
    title: "執筆300文字",
    worldTitle: "書斎での記録",
    minimumRule: "タイトルだけでも達成",
    baseXp: 10,
    preferredOrder: 20
  },
  {
    id: "template-english",
    categoryId: "category-knowledge",
    title: "英語を学ぶ",
    worldTitle: "外国語教養",
    minimumRule: "Duolingo 1レッスンでも達成",
    baseXp: 10,
    preferredOrder: 30
  },
  {
    id: "template-piano",
    categoryId: "category-art",
    title: "ピアノ5分",
    worldTitle: "サロンでの演奏",
    minimumRule: "鍵盤に触れるだけでも達成",
    baseXp: 10,
    preferredOrder: 40
  },
  {
    id: "template-walk",
    categoryId: "category-health",
    title: "散歩する",
    worldTitle: "庭園散策",
    minimumRule: "家の周りを少し歩けば達成",
    baseXp: 5,
    preferredOrder: 50
  }
] as const;

export type ButlerMood =
  | "DELIGHTED"
  | "PROUD"
  | "CHEERFUL"
  | "CALM"
  | "WORRIED"
  | "LONELY"
  | "SULKING";

export const butlerMessages: Record<ButlerMood, readonly string[]> = {
  DELIGHTED: ["旦那様、本日は完璧でございます。屋敷中が誇らしげです。"],
  PROUD: ["見事なDaily Clearです。今日も人生ゲームが進みましたね。"],
  CHEERFUL: ["良い滑り出しです。あと少し、ご一緒いたしましょう。"],
  CALM: ["本日の任務をご用意しております。まずは小さな一歩から。"],
  WORRIED: ["最近お疲れでしょうか。最小の一歩だけでも十分でございます。"],
  LONELY: ["書斎のインク壺が、少し寂しそうにしております。"],
  SULKING: ["紅茶だけ淹れて帰る執事になってしまいました。"]
};

export const butlerNotificationTemplates = {
  MORNING: {
    title: "本日の任務でございます",
    body: "基本3件とボーナスをご用意しました。まずは小さな一歩から。"
  },
  MINIMUM_STEP: {
    title: "5分だけ、ご一緒に",
    body: "完璧でなくて構いません。最小の一歩でも立派な前進です。"
  },
  EVENING: {
    title: "書斎に灯りを",
    body: "本日の任務が少し残っております。ひとつだけでもいかがでしょう。"
  },
  STREAK_RISK: {
    title: "あと少しでDaily Clear",
    body: "基本任務を進めれば、本日の物語をつなげられます。"
  },
  LAST_CALL: {
    title: "就寝前の小さな一歩",
    body: "無理は禁物ですが、できそうなら最後にひとつだけ。"
  },
  RESTART: {
    title: "いつでも再開できます",
    body: "お帰りをお待ちしておりました。今日は1分だけでも十分でございます。"
  },
  CARE: {
    title: "本日はご自愛ください",
    body: "体調を整えることも大切な任務です。どうぞ無理なくお休みください。"
  },
  HOLIDAY: {
    title: "休日をお楽しみください",
    body: "休むことも物語の一部です。気が向けば小さな一歩だけどうぞ。"
  }
} as const;
