SELECT 
    g.id,
    g.owner_id,
	-- ดึง user_id ของสมาชิกคนแรก (ไม่รวมหัวหน้า)
    CASE 
        WHEN g.member_count > 1 THEN 
            (SELECT u.id 
             FROM users u 
             WHERE u.group_id = g.id 
               AND u.id != g.owner_id 
             ORDER BY u.created_at 
             LIMIT 1 OFFSET 0)
        ELSE NULL 
    END as member_id_1,
    
    -- ดึง user_id ของสมาชิกคนที่สอง (ไม่รวมหัวหน้า)
    CASE 
        WHEN g.member_count > 2 THEN 
            (SELECT u.id 
             FROM users u 
             WHERE u.group_id = g.id 
               AND u.id != g.owner_id 
             ORDER BY u.created_at 
             LIMIT 1 OFFSET 1)
        ELSE NULL 
    END as member_id_2,
    g.is_confirmed,
    g.invite_code,
    g.member_count,
    g.house_rank_1,
    g.house_rank_2,
    g.house_rank_3,
    g.house_rank_4,
    g.house_rank_5,
    g.house_rank_sub
FROM groups g
-- WHERE g.is_confirmed = TRUE