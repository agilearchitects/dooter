import { IAuthorDTO } from "./author.dto";

// Swedish books
export interface IBookDTO {
  title: string; // Book title
  author: IAuthorDTO[]; // Book author
  store: string | string[] // Book store name(s)
  binding?: "hardcover" | "spiral";
}