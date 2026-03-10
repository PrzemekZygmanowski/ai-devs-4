const requireEnv = (name: string): string => {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const resolvePort = (): number => {
  const rawPort = process.env.PORT?.trim();

  if (!rawPort) {
    return 3000;
  }

  const port = Number.parseInt(rawPort, 10);

  if (Number.isNaN(port)) {
    throw new Error(`Invalid PORT value: ${rawPort}`);
  }

  return port;
};

const hubBaseUrl = process.env.HUB_BASE_URL?.trim() || "https://hub.ag3nts.org";
const ag3ntsApiKey = requireEnv("AG3NTS_API_KEY");
const supabaseUrl = process.env.SUPABASE_URL?.trim() || null;
const supabaseKey = process.env.SUPABASE_KEY?.trim() || null;

export const env = {
  port: resolvePort(),
  ag3ntsApiKey,
  openAiApiKey: requireEnv("OPENAI_API_KEY"),
  openAiModel: process.env.OPENAI_MODEL?.trim() || "gpt-4.1-mini",
  supabaseUrl,
  supabaseKey,
  hasSupabaseConfig: Boolean(supabaseUrl && supabaseKey),
  hubBaseUrl,
  peopleCsvUrl: `${hubBaseUrl}/data/${ag3ntsApiKey}/people.csv`,
  verifyUrl: `${hubBaseUrl}/verify`,
} as const;
