import { describe, it } from "@jest/globals";
import { schemas } from "./interface-to-schema";
import { parseObject, ParseError , parseError } from "./parse-object";

describe("ParseObject", () => {
  describe("Multi type", () => {
    it("should parse", () => {
      const values = ["foo", 1, [true, false]];

      const results = values.map(value => parseObject(value, "string | number | boolean[]"));
      
      for(let a = 0; a < results.length; a++) {
        expect(results[a]).toEqual(values[a]);
      }
    });
    it("should throw error", () => {
      let coughtError: unknown;
      try {
        parseObject("foo", "boolean");
      } catch(error: unknown) {
        coughtError = error;
      }
      
      expect(coughtError).toBeDefined();
      expect(coughtError).toBeInstanceOf(ParseError);
      expect((coughtError as ParseError).code).toEqual(parseError.WRONG_TYPE);
    });
  });
  describe("Array type", () => {
    it("should parse", () => {
      const values = [{
        value: ["foo", "bar"],
        type: "string[]"
      }, {
        value: [1, 2],
        type: "number[]"
      }, {
        value: [true, false],
        type: "boolean[]"
      }, {
        value: [null, null],
        type: "null[]"
      }];

      const results = values.map(value => parseObject(value.value, value.type));
    
      for(let a = 0; a < results.length; a++) {
        expect(results[a]).toEqual(values[a].value);
        expect(results[a]).toBeInstanceOf(Array);
        expect(results[a]).toHaveLength(2);
      }
    });
    it("should throw error", () => {
      try {
        parseObject("foo", "string[]");
      } catch(error: unknown) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).code).toEqual(parseError.WRONG_TYPE);
      }
    });
  });
  describe("Simple type", () => {
    it("should be able to parse", () => {
      const values = [{
        value: "foo",
        type: "string"
      }, {
        value: 1,
        type: "number"
      }, {
        value: true,
        type: "boolean"
      }, {
        value: null,
        type: "null"
      }];

      const results = values.map(value => parseObject(value.value, value.type));
    
      for(let a = 0; a < results.length; a++) {
        expect(results[a]).toEqual(values[a].value);
      }
    });
    it("should throw error", () => {
      try {
        parseObject("foo", "number");
      } catch(error: unknown) {
        expect(error).toBeInstanceOf(ParseError);
        expect((error as ParseError).code).toEqual(parseError.WRONG_TYPE);
      }
    });
  });
  describe("Schema type", () => {
    const schemas: schemas = {
      book: {
        properties: {
          title: "string",
          author: "string",
          store: { type: "string | store | store[]", optional: true },
        }
      },
      store: {
        properties: {
          name: "string",
          street: { type: "string", optional: true }
        }
      }
    };
    it("should parse", () => {
      const value = { title: "my book", author: "Jon Doe", store: "The store" };
      parseObject(value, "book", schemas);
    });
    it("should parse without requiring optional params", () => {
      const value = { title: "my book", author: "Jon Doe" };
      parseObject(value, "book", schemas);
    });
    it("should parse nested schemas", () => {
      const value = [
        { title: "my book", author: "Jon Doe", store: { name: "Superstore USA", street: "First Street 1" } },
        { title: "my book", author: "Jon Doe", store: [{ name: "Superstore USA" }, { name: "Dealbreaker" }] },
      ];
      parseObject(value, "book[]", schemas);
    });
    it("should throw error on missing property", () => {
      let coughtError: unknown;
      try {
        parseObject({ title: "my book" }, "book", schemas);
      } catch(error: unknown) {
        coughtError = error;
      }

      expect(coughtError).toBeInstanceOf(ParseError);
      expect((coughtError as ParseError).code).toEqual(parseError.PROPERTY_VALUE_NOT_FOUND);
      expect((coughtError as ParseError).schema?.name).toEqual("book");
      expect((coughtError as ParseError).property?.name).toEqual("author");
    });
    it("should throw error on excessive property", () => {
      let coughtError: unknown;
      try {
        parseObject({ foo: "bar" }, "book", schemas);
      } catch(error: unknown) {
        coughtError = error;
      }

      expect(coughtError).toBeInstanceOf(ParseError);
      expect((coughtError as ParseError).code).toEqual(parseError.PROPERTY_NOT_EXISTS_IN_SCHEMA);
    });
  });
  describe("Literal", () => {
    describe("String", () =>  {
      it("should parse", () => {
        parseObject({
          binding: "hardcover"
        }, "book", {
          book: {
            properties: {
              binding: "'hardcover' | 'spiral'"
            }
          }
        });
      });
      it("should throw error on wrong literal", () => {
        let coughtError: unknown;
        try {
          parseObject({ binding: "stapled" }, "book", {
            book: {
              properties: {
                binding: "'hardcover' | 'spiral'"
              }
            }
          });
        } catch(error: unknown) {
          coughtError = error;
        }
      
        expect(coughtError).toBeInstanceOf(ParseError);
        expect((coughtError as ParseError).code).toEqual(parseError.WRONG_TYPE);
      });
    });
    describe("Number", () => {
      it("should parse", () => {
        parseObject({
          rating: 1
        }, "book", {
          book: {
            properties: {
              rating: "1 | 2 | 3"
            }
          }
        });
      });
      it("should throw error on wrong literal", () => {
        let coughtError: unknown;
        try {
          parseObject({ rating: 5 }, "book", {
            book: {
              properties: {
                rating: "1 | 2 | 3"
              }
            }
          });
        } catch(error: unknown) {
          coughtError = error;
        }
      
        expect(coughtError).toBeInstanceOf(ParseError);
        expect((coughtError as ParseError).code).toEqual(parseError.WRONG_TYPE);
      });
    });
    describe("True or False", () => {
      it("should parse", () => {
        parseObject({
          usMarket: true
        }, "book", {
          book: {
            properties: {
              usMarket: { type: "true", optional: true }
            }
          }
        });
      });
      it("should throw error on wrong literal", () => {
        let coughtError: unknown;
        try {
          parseObject({ usMarket: false }, "book", {
            book: {
              properties: {
                usMarket: { type: "true", optional: true }
              }
            }
          });
        } catch(error: unknown) {
          coughtError = error;
        }
      
        expect(coughtError).toBeInstanceOf(ParseError);
        expect((coughtError as ParseError).code).toEqual(parseError.WRONG_TYPE);
      });
    });
  });
});