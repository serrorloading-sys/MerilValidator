-- 🔥 CHECK MY ROLE 🔥

-- 1. Run this to see what role your user has in the database
--    Repace the email with yours if needed, but this checks all users with '61608' in their email.
SELECT id, email, role 
FROM public.profiles
WHERE email = '61608@merillife.com';

-- 2. If the 'role' column says 'user' instead of 'admin', 
--    then run the FIX script again:

/*
UPDATE public.profiles
SET role = 'admin'
WHERE email = '61608@merillife.com';
*/
