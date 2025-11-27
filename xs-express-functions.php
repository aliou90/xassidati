<?php
function isArabic($data){
    // Vérifie si le premier vers est en langue arabe
    return preg_match('/\p{Arabic}/u', $data); 
}

?>
