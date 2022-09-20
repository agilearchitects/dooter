# Dooter
Library for creating descriptive schemas from typescript interfaces and validating JSON object according to same type of schemas

## Restrictions
**!!!INTERFACES MUST BE NAMED WITH PREFIXED "I", NAME IN PASCAL CASE AND SUFFIXED "DTO" EG: "book" = "IBookDTO"!!!**

**!!!INTERFACE FILES MUST BE NAMED IN KEBAB CASE PREFIXED WITH ".dto". EG: "bookStore" = "book-store.dto.ts"!!!**

This will most likely be updated with custom naming overide possibilities 

## Examples

### Create schema from interface
`// test/dto/author.dto.ts`
```ts
// Swedish authors
export interface IAuthorDTO {
  // Authors lastname
  lastname: string;
  // Authors firstname (if exists)
  firstname?: string;
}
````

With typescript:
```ts
import { fileToSchema } from "@agilearchitects/dooter";
const schema = fileToSchema("./test/dto/author.dto.ts", "IAuthorDTO");
console.log(JSON.stringify(schema, null, 2))
```
Outputs:
```json
{
  "name": "author",
  "description": "Swedish authors",
  "properties": {
    "lastname": {
      "type": "string",
      "description": "Authors lastname"
    },
    "firstname": {
      "type": "string",
      "description": "Authors firstname (if exists)",
      "optional": true
    }
  }
}
```
*Comments on the line right before a schema or prop definition maps to corresponding description in schema*

Or with multiple files
```ts
import { filesToSchemas } from "@agilearchitects/dooter";
const schemas = filesToSchemas("./test/dto", ["book", "author"]);
console.log(JSON.stringify(schemas, null, 2))
```

Outputs:
```json
{
  "book": {
    "description": "Swedish books",
    "properties": {
      "title": "string",
      "author": {
        "type": "author[]",
        "description": "Book title"
      },
      "store": {
        "type": "string | string[]",
        "description": "Book author"
      },
      "binding": {
        "type": "'hardcover' | 'spiral'",
        "description": "Book store name(s)",
        "optional": true
      }
    }
  },
  "author": {
    "description": "Swedish authors",
    "properties": {
      "lastname": {
        "type": "string",
        "description": "Authors lastname"
      },
      "firstname": {
        "type": "string",
        "description": "Authors firstname (if exists)",
        "optional": true
      }
    }
  }
}
```
### Parse object
The `parseObject` allows validation of an object as type

Simple validation of object and type
```ts
import { parseObject } from "@agilearchitects/dooter";
const obj = "hello world";
const type = "string";
parseObject(obj, type));
```
`parseObject` will either return the object itself or throw an error if not valid

Union type is also acceptable
```ts
import { parseObject } from "@agilearchitects/dooter";
const obj1 = "hello world";
const obj2 = 2;
const type = "string | number";
parseObject(obj1, type));
parseObject(obj2, type));
```

As well as array type
```ts
import { parseObject } from "@agilearchitects/dooter";
const obj = ["hello", "world"];
const type = "string[]";
parseObject(obj, type));
```

Union type IS NOT allowed. Eg. `"(string, number)[]"`

Allowed types are: `string`, `number`, `boolean`, `null`, `undefined`, `true` and `false`. String and numeric literals are also allowed for enum behavior.

```ts
import { parseObject } from "@agilearchitects/dooter";
const type = "'blue' | 'green' | 'yellow'";
parseObject("blue", type));
parseObject("green", type));
parseObject("brown", type)); // Will throw error
```
String literals are encased with single quotes

### Parse schema
`parseObject` also allowes schema input for parsing nested objects mapping to schema names

```ts
import { filesToSchemas, parseObject } from "@agilearchitects/dooter";

const schemas = filesToSchemas("./test/dto", ["book", "author"]);
const author = {
    firstName: "Jon"
    lastName: "Doe",
  };
const book = [{
  title: "My Book",
  author: [author, {
    lastName: "Walker"
  }],
  store: "The bookStore",
  binding: "hardcover"
}, {
  title: "My Second Book",
  author: [author],
  store: ["The Bookstore", "Amazing"]
}]
parseObject(books, "book", schemas);
parseObject(author, "author", schemas);
```