-- SAIDANのデータ保存テーブル
-- Supabase の SQL Editor に貼り付けて実行してください

-- ユーザーデータテーブル
CREATE TABLE IF NOT EXISTS user_data (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  data        text NOT NULL,
  updated_at  timestamptz DEFAULT now()
);

-- Row Level Security を有効化
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 自分のデータだけ読める
CREATE POLICY "Users can read own data"
  ON user_data FOR SELECT
  USING (auth.uid() = user_id);

-- 自分のデータだけ書ける
CREATE POLICY "Users can insert own data"
  ON user_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- 自分のデータだけ更新できる
CREATE POLICY "Users can update own data"
  ON user_data FOR UPDATE
  USING (auth.uid() = user_id);

-- 自分のデータだけ削除できる
CREATE POLICY "Users can delete own data"
  ON user_data FOR DELETE
  USING (auth.uid() = user_id);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_data_updated_at
  BEFORE UPDATE ON user_data
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
