import axios from "axios";

export const euro3Price = async () => {
  try {
    const response = await axios.get("https://api-linea.3adao.org/prices");
    return response.data.EURO3_all.EURO3;
  } catch (error) {
    console.error("Error fetching price data for EURO3:", error);
    return null;
  }
};
