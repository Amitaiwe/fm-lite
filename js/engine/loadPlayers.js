// טעינת מאגר השחקנים מ-players.json (דפדפן בלבד - משתמש ב-fetch).

import { validatePlayers } from "./playersRepo.js";

export async function loadPlayersFromFile(path = "players.json") {
  let response;
  try {
    response = await fetch(path);
  } catch (err) {
    throw new Error(`לא ניתן לטעון את ${path}: ${err.message}`);
  }
  if (!response.ok) {
    throw new Error(`לא ניתן לטעון את ${path}: שגיאת שרת ${response.status}`);
  }
  let data;
  try {
    data = await response.json();
  } catch (err) {
    throw new Error(`הקובץ ${path} אינו JSON תקין`);
  }
  validatePlayers(data);
  return data;
}
