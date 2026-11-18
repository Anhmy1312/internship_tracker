INSERT INTO users (email, password_hash, name) VALUES
('demo@example.com', 'week-4-no-auth-yet', 'Demo User')
ON CONFLICT (email) DO NOTHING;

INSERT INTO applications
    (user_id, company, role, jd_url, location, remote, deadline, status, notes)
SELECT 
    u.id,
    'Shopee',
    'Frontend Intern',
    'https://careers.shopee.sg/',
    'Singapore',
    false,
    DATE '2027-03-15',
    'applied',
    'Referral from a senior'
FROM users u
WHERE u.email = 'demo@example.com' AND NOT EXISTS(
    SELECT 1 
    FROM applications a
    WHERE a.user_id = u.id
        AND a.company = 'Shopee'
        AND a.role = 'Frontend Intern'
    );

INSERT INTO applications
    (user_id, company, role, jd_url, location, remote, deadline, status, notes)
SELECT
    u.id,
    'Grab',
    'Software Engineer Intern',
    'https://www.grab.careers/',
    'Remote',
    true,
    DATE '2027-04-01',
    'wishlist',
    'Need to tailor CV'
FROM users u
WHERE u.email = 'demo@example.com' AND NOT EXISTS (
        SELECT 1
        FROM applications a
        WHERE a.user_id = u.id
        AND a.company = 'Grab'
        AND a.role = 'Software Engineer Intern'
    );

INSERT INTO applications
    (user_id, company, role, jd_url, location, remote, deadline, status, notes)
SELECT
    u.id,
    'Local startup',
    'Fullstack Intern',
    '',
    'Ho Chi Minh City',
    false,
    DATE '2027-02-20',
    'interview',
    'First round next week'
FROM users u
WHERE u.email = 'demo@example.com' AND NOT EXISTS (
        SELECT 1
        FROM applications a
        WHERE a.user_id = u.id
        AND a.company = 'Local startup'
        AND a.role = 'Fullstack Intern'
    );