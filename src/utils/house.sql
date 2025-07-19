SELECT id, 
    name_th AS houseName,
    size_letter AS sizeName,
    capacity
FROM houses
ORDER BY 
    CASE size_letter 
        WHEN 'S' THEN 1
        WHEN 'M' THEN 2
        WHEN 'L' THEN 3
        WHEN 'XL' THEN 4
        WHEN 'XXL' THEN 5
        ELSE 6
    END,
    name_th ASC;