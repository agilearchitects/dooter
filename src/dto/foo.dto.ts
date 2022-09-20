import { IBarDTO } from "./bar.dto";

// Hello World
export interface IFooDTO {
  // Bar
  bar: number | number[] | "korv" | "ss"[] | boolean | false | IBarDTO | IBarDTO[];
}
