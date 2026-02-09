-- 🔥 FIX ADMIN ROLE FOR USER 61608@merillife.com 🔥

-- 1. Sets the role to 'admin' specifically for this email
UPDATE public.profiles
SET role = 'admin'
WHERE email = '61608@merillife.com';

-- 2. Verify the change by selecting the user
SELECT id, email, username, role 
FROM public.profiles 
WHERE email = '61608@merillife.com';
