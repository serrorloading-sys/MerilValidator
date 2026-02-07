
-- 1. Create Data Table with JSONB for flexible data storage
CREATE TABLE IF NOT EXISTS user_data (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    tool_name TEXT NOT NULL,
    file_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tool_name) -- Each user has one save per tool
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

-- 3. Create Policies (Users can only see/edit their own data)
CREATE POLICY "Users can insert their own data" 
ON user_data FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own data" 
ON user_data FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own data" 
ON user_data FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own data" 
ON user_data FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Enable Realtime (Optional, for auto-updates if multiple tabs open)
alter publication supabase_realtime add table user_data;
