
/**
 * Client
**/

import * as runtime from './runtime/client.js';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

export type PrismaPromise<T> = $Public.PrismaPromise<T>


/**
 * Model Trip
 * 
 */
export type Trip = $Result.DefaultSelection<Prisma.$TripPayload>
/**
 * Model SOS
 * 
 */
export type SOS = $Result.DefaultSelection<Prisma.$SOSPayload>

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new PrismaClient({
 *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
 * })
 * // Fetch zero or more Trips
 * const trips = await prisma.trip.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://pris.ly/d/client).
 */
export class PrismaClient<
  ClientOptions extends Prisma.PrismaClientOptions = Prisma.PrismaClientOptions,
  const U = 'log' extends keyof ClientOptions ? ClientOptions['log'] extends Array<Prisma.LogLevel | Prisma.LogDefinition> ? Prisma.GetEvents<ClientOptions['log']> : never : never,
  ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs
> {
  [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['other'] }

    /**
   * ##  Prisma Client ʲˢ
   *
   * Type-safe database client for TypeScript & Node.js
   * @example
   * ```
   * const prisma = new PrismaClient({
   *   adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
   * })
   * // Fetch zero or more Trips
   * const trips = await prisma.trip.findMany()
   * ```
   *
   *
   * Read more in our [docs](https://pris.ly/d/client).
   */

  constructor(optionsArg ?: Prisma.Subset<ClientOptions, Prisma.PrismaClientOptions>);
  $on<V extends U>(eventType: V, callback: (event: V extends 'query' ? Prisma.QueryEvent : Prisma.LogEvent) => void): PrismaClient;

  /**
   * Connect with the database
   */
  $connect(): $Utils.JsPromise<void>;

  /**
   * Disconnect from the database
   */
  $disconnect(): $Utils.JsPromise<void>;

/**
   * Executes a prepared raw query and returns the number of affected rows.
   * @example
   * ```
   * const result = await prisma.$executeRaw`UPDATE User SET cool = ${true} WHERE email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Executes a raw query and returns the number of affected rows.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$executeRawUnsafe('UPDATE User SET cool = $1 WHERE email = $2 ;', true, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $executeRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<number>;

  /**
   * Performs a prepared raw query and returns the `SELECT` data.
   * @example
   * ```
   * const result = await prisma.$queryRaw`SELECT * FROM User WHERE id = ${1} OR email = ${'user@email.com'};`
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRaw<T = unknown>(query: TemplateStringsArray | Prisma.Sql, ...values: any[]): Prisma.PrismaPromise<T>;

  /**
   * Performs a raw query and returns the `SELECT` data.
   * Susceptible to SQL injections, see documentation.
   * @example
   * ```
   * const result = await prisma.$queryRawUnsafe('SELECT * FROM User WHERE id = $1 OR email = $2;', 1, 'user@email.com')
   * ```
   *
   * Read more in our [docs](https://pris.ly/d/raw-queries).
   */
  $queryRawUnsafe<T = unknown>(query: string, ...values: any[]): Prisma.PrismaPromise<T>;


  /**
   * Allows the running of a sequence of read/write operations that are guaranteed to either succeed or fail as a whole.
   * @example
   * ```
   * const [george, bob, alice] = await prisma.$transaction([
   *   prisma.user.create({ data: { name: 'George' } }),
   *   prisma.user.create({ data: { name: 'Bob' } }),
   *   prisma.user.create({ data: { name: 'Alice' } }),
   * ])
   * ```
   * 
   * Read more in our [docs](https://www.prisma.io/docs/orm/prisma-client/queries/transactions).
   */
  $transaction<P extends Prisma.PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<runtime.Types.Utils.UnwrapTuple<P>>

  $transaction<R>(fn: (prisma: Omit<PrismaClient, runtime.ITXClientDenyList>) => $Utils.JsPromise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: Prisma.TransactionIsolationLevel }): $Utils.JsPromise<R>

  $extends: $Extensions.ExtendsHook<"extends", Prisma.TypeMapCb<ClientOptions>, ExtArgs, $Utils.Call<Prisma.TypeMapCb<ClientOptions>, {
    extArgs: ExtArgs
  }>>

      /**
   * `prisma.trip`: Exposes CRUD operations for the **Trip** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more Trips
    * const trips = await prisma.trip.findMany()
    * ```
    */
  get trip(): Prisma.TripDelegate<ExtArgs, ClientOptions>;

  /**
   * `prisma.sOS`: Exposes CRUD operations for the **SOS** model.
    * Example usage:
    * ```ts
    * // Fetch zero or more SOS
    * const sOS = await prisma.sOS.findMany()
    * ```
    */
  get sOS(): Prisma.SOSDelegate<ExtArgs, ClientOptions>;
}

export namespace Prisma {
  export import DMMF = runtime.DMMF

  export type PrismaPromise<T> = $Public.PrismaPromise<T>

  /**
   * Validator
   */
  export import validator = runtime.Public.validator

  /**
   * Prisma Errors
   */
  export import PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError
  export import PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError
  export import PrismaClientRustPanicError = runtime.PrismaClientRustPanicError
  export import PrismaClientInitializationError = runtime.PrismaClientInitializationError
  export import PrismaClientValidationError = runtime.PrismaClientValidationError

  /**
   * Re-export of sql-template-tag
   */
  export import sql = runtime.sqltag
  export import empty = runtime.empty
  export import join = runtime.join
  export import raw = runtime.raw
  export import Sql = runtime.Sql



  /**
   * Decimal.js
   */
  export import Decimal = runtime.Decimal

  export type DecimalJsLike = runtime.DecimalJsLike

  /**
  * Extensions
  */
  export import Extension = $Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export import Args = $Public.Args
  export import Payload = $Public.Payload
  export import Result = $Public.Result
  export import Exact = $Public.Exact

  /**
   * Prisma Client JS version: 7.5.0
   * Query Engine version: 280c870be64f457428992c43c1f6d557fab6e29e
   */
  export type PrismaVersion = {
    client: string
    engine: string
  }

  export const prismaVersion: PrismaVersion

  /**
   * Utility Types
   */


  export import Bytes = runtime.Bytes
  export import JsonObject = runtime.JsonObject
  export import JsonArray = runtime.JsonArray
  export import JsonValue = runtime.JsonValue
  export import InputJsonObject = runtime.InputJsonObject
  export import InputJsonArray = runtime.InputJsonArray
  export import InputJsonValue = runtime.InputJsonValue

  /**
   * Types of the values used to represent different kinds of `null` values when working with JSON fields.
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  namespace NullTypes {
    /**
    * Type of `Prisma.DbNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.DbNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class DbNull {
      private DbNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.JsonNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.JsonNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class JsonNull {
      private JsonNull: never
      private constructor()
    }

    /**
    * Type of `Prisma.AnyNull`.
    *
    * You cannot use other instances of this class. Please use the `Prisma.AnyNull` value.
    *
    * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
    */
    class AnyNull {
      private AnyNull: never
      private constructor()
    }
  }

  /**
   * Helper for filtering JSON entries that have `null` on the database (empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const DbNull: NullTypes.DbNull

  /**
   * Helper for filtering JSON entries that have JSON `null` values (not empty on the db)
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const JsonNull: NullTypes.JsonNull

  /**
   * Helper for filtering JSON entries that are `Prisma.DbNull` or `Prisma.JsonNull`
   *
   * @see https://www.prisma.io/docs/concepts/components/prisma-client/working-with-fields/working-with-json-fields#filtering-on-a-json-field
   */
  export const AnyNull: NullTypes.AnyNull

  type SelectAndInclude = {
    select: any
    include: any
  }

  type SelectAndOmit = {
    select: any
    omit: any
  }

  /**
   * Get the type of the value, that the Promise holds.
   */
  export type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T;

  /**
   * Get the return type of a function which returns a Promise.
   */
  export type PromiseReturnType<T extends (...args: any) => $Utils.JsPromise<any>> = PromiseType<ReturnType<T>>

  /**
   * From T, pick a set of properties whose keys are in the union K
   */
  type Prisma__Pick<T, K extends keyof T> = {
      [P in K]: T[P];
  };


  export type Enumerable<T> = T | Array<T>;

  export type RequiredKeys<T> = {
    [K in keyof T]-?: {} extends Prisma__Pick<T, K> ? never : K
  }[keyof T]

  export type TruthyKeys<T> = keyof {
    [K in keyof T as T[K] extends false | undefined | null ? never : K]: K
  }

  export type TrueKeys<T> = TruthyKeys<Prisma__Pick<T, RequiredKeys<T>>>

  /**
   * Subset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection
   */
  export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
  };

  /**
   * SelectSubset
   * @desc From `T` pick properties that exist in `U`. Simple version of Intersection.
   * Additionally, it validates, if both select and include are present. If the case, it errors.
   */
  export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    (T extends SelectAndInclude
      ? 'Please either choose `select` or `include`.'
      : T extends SelectAndOmit
        ? 'Please either choose `select` or `omit`.'
        : {})

  /**
   * Subset + Intersection
   * @desc From `T` pick properties that exist in `U` and intersect `K`
   */
  export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never
  } &
    K

  type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never };

  /**
   * XOR is needed to have a real mutually exclusive union type
   * https://stackoverflow.com/questions/42123407/does-typescript-support-mutually-exclusive-types
   */
  type XOR<T, U> =
    T extends object ?
    U extends object ?
      (Without<T, U> & U) | (Without<U, T> & T)
    : U : T


  /**
   * Is T a Record?
   */
  type IsObject<T extends any> = T extends Array<any>
  ? False
  : T extends Date
  ? False
  : T extends Uint8Array
  ? False
  : T extends BigInt
  ? False
  : T extends object
  ? True
  : False


  /**
   * If it's T[], return T
   */
  export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T

  /**
   * From ts-toolbelt
   */

  type __Either<O extends object, K extends Key> = Omit<O, K> &
    {
      // Merge all but K
      [P in K]: Prisma__Pick<O, P & keyof O> // With K possibilities
    }[K]

  type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>

  type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>

  type _Either<
    O extends object,
    K extends Key,
    strict extends Boolean
  > = {
    1: EitherStrict<O, K>
    0: EitherLoose<O, K>
  }[strict]

  type Either<
    O extends object,
    K extends Key,
    strict extends Boolean = 1
  > = O extends unknown ? _Either<O, K, strict> : never

  export type Union = any

  type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K]
  } & {}

  /** Helper Types for "Merge" **/
  export type IntersectOf<U extends Union> = (
    U extends unknown ? (k: U) => void : never
  ) extends (k: infer I) => void
    ? I
    : never

  export type Overwrite<O extends object, O1 extends object> = {
      [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
  } & {};

  type _Merge<U extends object> = IntersectOf<Overwrite<U, {
      [K in keyof U]-?: At<U, K>;
  }>>;

  type Key = string | number | symbol;
  type AtBasic<O extends object, K extends Key> = K extends keyof O ? O[K] : never;
  type AtStrict<O extends object, K extends Key> = O[K & keyof O];
  type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
  export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
      1: AtStrict<O, K>;
      0: AtLoose<O, K>;
  }[strict];

  export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
  } & {};

  export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
  } & {};

  type _Record<K extends keyof any, T> = {
    [P in K]: T;
  };

  // cause typescript not to expand types and preserve names
  type NoExpand<T> = T extends unknown ? T : never;

  // this type assumes the passed object is entirely optional
  type AtLeast<O extends object, K extends string> = NoExpand<
    O extends unknown
    ? | (K extends keyof O ? { [P in K]: O[P] } & O : O)
      | {[P in keyof O as P extends K ? P : never]-?: O[P]} & O
    : never>;

  type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;

  export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
  /** End Helper Types for "Merge" **/

  export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;

  /**
  A [[Boolean]]
  */
  export type Boolean = True | False

  // /**
  // 1
  // */
  export type True = 1

  /**
  0
  */
  export type False = 0

  export type Not<B extends Boolean> = {
    0: 1
    1: 0
  }[B]

  export type Extends<A1 extends any, A2 extends any> = [A1] extends [never]
    ? 0 // anything `never` is false
    : A1 extends A2
    ? 1
    : 0

  export type Has<U extends Union, U1 extends Union> = Not<
    Extends<Exclude<U1, U>, U1>
  >

  export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
      0: 0
      1: 1
    }
    1: {
      0: 1
      1: 1
    }
  }[B1][B2]

  export type Keys<U extends Union> = U extends unknown ? keyof U : never

  type Cast<A, B> = A extends B ? A : B;

  export const type: unique symbol;



  /**
   * Used by group by
   */

  export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O
      ? O[P]
      : never
  } : never

  type FieldPaths<
    T,
    U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>
  > = IsObject<T> extends True ? U : T

  type GetHavingFields<T> = {
    [K in keyof T]: Or<
      Or<Extends<'OR', K>, Extends<'AND', K>>,
      Extends<'NOT', K>
    > extends True
      ? // infer is only needed to not hit TS limit
        // based on the brilliant idea of Pierre-Antoine Mills
        // https://github.com/microsoft/TypeScript/issues/30188#issuecomment-478938437
        T[K] extends infer TK
        ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never>
        : never
      : {} extends FieldPaths<T[K]>
      ? never
      : K
  }[keyof T]

  /**
   * Convert tuple to union
   */
  type _TupleToUnion<T> = T extends (infer E)[] ? E : never
  type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>
  type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T

  /**
   * Like `Pick`, but additionally can also accept an array of keys
   */
  type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>

  /**
   * Exclude all keys with underscores
   */
  type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T


  export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>

  type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>


  export const ModelName: {
    Trip: 'Trip',
    SOS: 'SOS'
  };

  export type ModelName = (typeof ModelName)[keyof typeof ModelName]



  interface TypeMapCb<ClientOptions = {}> extends $Utils.Fn<{extArgs: $Extensions.InternalArgs }, $Utils.Record<string, any>> {
    returns: Prisma.TypeMap<this['params']['extArgs'], ClientOptions extends { omit: infer OmitOptions } ? OmitOptions : {}>
  }

  export type TypeMap<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
      omit: GlobalOmitOptions
    }
    meta: {
      modelProps: "trip" | "sOS"
      txIsolationLevel: Prisma.TransactionIsolationLevel
    }
    model: {
      Trip: {
        payload: Prisma.$TripPayload<ExtArgs>
        fields: Prisma.TripFieldRefs
        operations: {
          findUnique: {
            args: Prisma.TripFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.TripFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          findFirst: {
            args: Prisma.TripFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.TripFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          findMany: {
            args: Prisma.TripFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>[]
          }
          create: {
            args: Prisma.TripCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          createMany: {
            args: Prisma.TripCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.TripCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>[]
          }
          delete: {
            args: Prisma.TripDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          update: {
            args: Prisma.TripUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          deleteMany: {
            args: Prisma.TripDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.TripUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.TripUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>[]
          }
          upsert: {
            args: Prisma.TripUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$TripPayload>
          }
          aggregate: {
            args: Prisma.TripAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateTrip>
          }
          groupBy: {
            args: Prisma.TripGroupByArgs<ExtArgs>
            result: $Utils.Optional<TripGroupByOutputType>[]
          }
          count: {
            args: Prisma.TripCountArgs<ExtArgs>
            result: $Utils.Optional<TripCountAggregateOutputType> | number
          }
        }
      }
      SOS: {
        payload: Prisma.$SOSPayload<ExtArgs>
        fields: Prisma.SOSFieldRefs
        operations: {
          findUnique: {
            args: Prisma.SOSFindUniqueArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload> | null
          }
          findUniqueOrThrow: {
            args: Prisma.SOSFindUniqueOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          findFirst: {
            args: Prisma.SOSFindFirstArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload> | null
          }
          findFirstOrThrow: {
            args: Prisma.SOSFindFirstOrThrowArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          findMany: {
            args: Prisma.SOSFindManyArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>[]
          }
          create: {
            args: Prisma.SOSCreateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          createMany: {
            args: Prisma.SOSCreateManyArgs<ExtArgs>
            result: BatchPayload
          }
          createManyAndReturn: {
            args: Prisma.SOSCreateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>[]
          }
          delete: {
            args: Prisma.SOSDeleteArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          update: {
            args: Prisma.SOSUpdateArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          deleteMany: {
            args: Prisma.SOSDeleteManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateMany: {
            args: Prisma.SOSUpdateManyArgs<ExtArgs>
            result: BatchPayload
          }
          updateManyAndReturn: {
            args: Prisma.SOSUpdateManyAndReturnArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>[]
          }
          upsert: {
            args: Prisma.SOSUpsertArgs<ExtArgs>
            result: $Utils.PayloadToResult<Prisma.$SOSPayload>
          }
          aggregate: {
            args: Prisma.SOSAggregateArgs<ExtArgs>
            result: $Utils.Optional<AggregateSOS>
          }
          groupBy: {
            args: Prisma.SOSGroupByArgs<ExtArgs>
            result: $Utils.Optional<SOSGroupByOutputType>[]
          }
          count: {
            args: Prisma.SOSCountArgs<ExtArgs>
            result: $Utils.Optional<SOSCountAggregateOutputType> | number
          }
        }
      }
    }
  } & {
    other: {
      payload: any
      operations: {
        $executeRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $executeRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
        $queryRaw: {
          args: [query: TemplateStringsArray | Prisma.Sql, ...values: any[]],
          result: any
        }
        $queryRawUnsafe: {
          args: [query: string, ...values: any[]],
          result: any
        }
      }
    }
  }
  export const defineExtension: $Extensions.ExtendsHook<"define", Prisma.TypeMapCb, $Extensions.DefaultArgs>
  export type DefaultPrismaClient = PrismaClient
  export type ErrorFormat = 'pretty' | 'colorless' | 'minimal'
  export interface PrismaClientOptions {
    /**
     * @default "colorless"
     */
    errorFormat?: ErrorFormat
    /**
     * @example
     * ```
     * // Shorthand for `emit: 'stdout'`
     * log: ['query', 'info', 'warn', 'error']
     * 
     * // Emit as events only
     * log: [
     *   { emit: 'event', level: 'query' },
     *   { emit: 'event', level: 'info' },
     *   { emit: 'event', level: 'warn' }
     *   { emit: 'event', level: 'error' }
     * ]
     * 
     * / Emit as events and log to stdout
     * og: [
     *  { emit: 'stdout', level: 'query' },
     *  { emit: 'stdout', level: 'info' },
     *  { emit: 'stdout', level: 'warn' }
     *  { emit: 'stdout', level: 'error' }
     * 
     * ```
     * Read more in our [docs](https://pris.ly/d/logging).
     */
    log?: (LogLevel | LogDefinition)[]
    /**
     * The default values for transactionOptions
     * maxWait ?= 2000
     * timeout ?= 5000
     */
    transactionOptions?: {
      maxWait?: number
      timeout?: number
      isolationLevel?: Prisma.TransactionIsolationLevel
    }
    /**
     * Instance of a Driver Adapter, e.g., like one provided by `@prisma/adapter-planetscale`
     */
    adapter?: runtime.SqlDriverAdapterFactory
    /**
     * Prisma Accelerate URL allowing the client to connect through Accelerate instead of a direct database.
     */
    accelerateUrl?: string
    /**
     * Global configuration for omitting model fields by default.
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   omit: {
     *     user: {
     *       password: true
     *     }
     *   }
     * })
     * ```
     */
    omit?: Prisma.GlobalOmitConfig
    /**
     * SQL commenter plugins that add metadata to SQL queries as comments.
     * Comments follow the sqlcommenter format: https://google.github.io/sqlcommenter/
     * 
     * @example
     * ```
     * const prisma = new PrismaClient({
     *   adapter,
     *   comments: [
     *     traceContext(),
     *     queryInsights(),
     *   ],
     * })
     * ```
     */
    comments?: runtime.SqlCommenterPlugin[]
  }
  export type GlobalOmitConfig = {
    trip?: TripOmit
    sOS?: SOSOmit
  }

  /* Types for Logging */
  export type LogLevel = 'info' | 'query' | 'warn' | 'error'
  export type LogDefinition = {
    level: LogLevel
    emit: 'stdout' | 'event'
  }

  export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;

  export type GetLogType<T> = CheckIsLogLevel<
    T extends LogDefinition ? T['level'] : T
  >;

  export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition>
    ? GetLogType<T[number]>
    : never;

  export type QueryEvent = {
    timestamp: Date
    query: string
    params: string
    duration: number
    target: string
  }

  export type LogEvent = {
    timestamp: Date
    message: string
    target: string
  }
  /* End Types for Logging */


  export type PrismaAction =
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'create'
    | 'createMany'
    | 'createManyAndReturn'
    | 'update'
    | 'updateMany'
    | 'updateManyAndReturn'
    | 'upsert'
    | 'delete'
    | 'deleteMany'
    | 'executeRaw'
    | 'queryRaw'
    | 'aggregate'
    | 'count'
    | 'runCommandRaw'
    | 'findRaw'
    | 'groupBy'

  // tested in getLogLevel.test.ts
  export function getLogLevel(log: Array<LogLevel | LogDefinition>): LogLevel | undefined;

  /**
   * `PrismaClient` proxy available in interactive transactions.
   */
  export type TransactionClient = Omit<Prisma.DefaultPrismaClient, runtime.ITXClientDenyList>

  export type Datasource = {
    url?: string
  }

  /**
   * Count Types
   */



  /**
   * Models
   */

  /**
   * Model Trip
   */

  export type AggregateTrip = {
    _count: TripCountAggregateOutputType | null
    _avg: TripAvgAggregateOutputType | null
    _sum: TripSumAggregateOutputType | null
    _min: TripMinAggregateOutputType | null
    _max: TripMaxAggregateOutputType | null
  }

  export type TripAvgAggregateOutputType = {
    pickupLat: number | null
    pickupLng: number | null
    dropoffLat: number | null
    dropoffLng: number | null
    estimatedFare: number | null
    actualFare: number | null
    promoDiscount: number | null
    distance: number | null
    duration: number | null
    driverRating: number | null
    riderRating: number | null
  }

  export type TripSumAggregateOutputType = {
    pickupLat: number | null
    pickupLng: number | null
    dropoffLat: number | null
    dropoffLng: number | null
    estimatedFare: number | null
    actualFare: number | null
    promoDiscount: number | null
    distance: number | null
    duration: number | null
    driverRating: number | null
    riderRating: number | null
  }

  export type TripMinAggregateOutputType = {
    id: string | null
    riderId: string | null
    driverId: string | null
    status: string | null
    pickupLat: number | null
    pickupLng: number | null
    pickupAddress: string | null
    dropoffLat: number | null
    dropoffLng: number | null
    dropoffAddress: string | null
    estimatedFare: number | null
    actualFare: number | null
    paymentMethod: string | null
    paymentStatus: string | null
    promoCode: string | null
    promoDiscount: number | null
    distance: number | null
    duration: number | null
    requestedAt: Date | null
    matchedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancellationReason: string | null
    cancelledBy: string | null
    driverRating: number | null
    riderRating: number | null
    updatedAt: Date | null
  }

  export type TripMaxAggregateOutputType = {
    id: string | null
    riderId: string | null
    driverId: string | null
    status: string | null
    pickupLat: number | null
    pickupLng: number | null
    pickupAddress: string | null
    dropoffLat: number | null
    dropoffLng: number | null
    dropoffAddress: string | null
    estimatedFare: number | null
    actualFare: number | null
    paymentMethod: string | null
    paymentStatus: string | null
    promoCode: string | null
    promoDiscount: number | null
    distance: number | null
    duration: number | null
    requestedAt: Date | null
    matchedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancellationReason: string | null
    cancelledBy: string | null
    driverRating: number | null
    riderRating: number | null
    updatedAt: Date | null
  }

  export type TripCountAggregateOutputType = {
    id: number
    riderId: number
    driverId: number
    status: number
    pickupLat: number
    pickupLng: number
    pickupAddress: number
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: number
    estimatedFare: number
    actualFare: number
    paymentMethod: number
    paymentStatus: number
    promoCode: number
    promoDiscount: number
    distance: number
    duration: number
    requestedAt: number
    matchedAt: number
    startedAt: number
    completedAt: number
    cancelledAt: number
    cancellationReason: number
    cancelledBy: number
    driverRating: number
    riderRating: number
    updatedAt: number
    _all: number
  }


  export type TripAvgAggregateInputType = {
    pickupLat?: true
    pickupLng?: true
    dropoffLat?: true
    dropoffLng?: true
    estimatedFare?: true
    actualFare?: true
    promoDiscount?: true
    distance?: true
    duration?: true
    driverRating?: true
    riderRating?: true
  }

  export type TripSumAggregateInputType = {
    pickupLat?: true
    pickupLng?: true
    dropoffLat?: true
    dropoffLng?: true
    estimatedFare?: true
    actualFare?: true
    promoDiscount?: true
    distance?: true
    duration?: true
    driverRating?: true
    riderRating?: true
  }

  export type TripMinAggregateInputType = {
    id?: true
    riderId?: true
    driverId?: true
    status?: true
    pickupLat?: true
    pickupLng?: true
    pickupAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    dropoffAddress?: true
    estimatedFare?: true
    actualFare?: true
    paymentMethod?: true
    paymentStatus?: true
    promoCode?: true
    promoDiscount?: true
    distance?: true
    duration?: true
    requestedAt?: true
    matchedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancellationReason?: true
    cancelledBy?: true
    driverRating?: true
    riderRating?: true
    updatedAt?: true
  }

  export type TripMaxAggregateInputType = {
    id?: true
    riderId?: true
    driverId?: true
    status?: true
    pickupLat?: true
    pickupLng?: true
    pickupAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    dropoffAddress?: true
    estimatedFare?: true
    actualFare?: true
    paymentMethod?: true
    paymentStatus?: true
    promoCode?: true
    promoDiscount?: true
    distance?: true
    duration?: true
    requestedAt?: true
    matchedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancellationReason?: true
    cancelledBy?: true
    driverRating?: true
    riderRating?: true
    updatedAt?: true
  }

  export type TripCountAggregateInputType = {
    id?: true
    riderId?: true
    driverId?: true
    status?: true
    pickupLat?: true
    pickupLng?: true
    pickupAddress?: true
    dropoffLat?: true
    dropoffLng?: true
    dropoffAddress?: true
    estimatedFare?: true
    actualFare?: true
    paymentMethod?: true
    paymentStatus?: true
    promoCode?: true
    promoDiscount?: true
    distance?: true
    duration?: true
    requestedAt?: true
    matchedAt?: true
    startedAt?: true
    completedAt?: true
    cancelledAt?: true
    cancellationReason?: true
    cancelledBy?: true
    driverRating?: true
    riderRating?: true
    updatedAt?: true
    _all?: true
  }

  export type TripAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Trip to aggregate.
     */
    where?: TripWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Trips to fetch.
     */
    orderBy?: TripOrderByWithRelationInput | TripOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: TripWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Trips from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Trips.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned Trips
    **/
    _count?: true | TripCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: TripAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: TripSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: TripMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: TripMaxAggregateInputType
  }

  export type GetTripAggregateType<T extends TripAggregateArgs> = {
        [P in keyof T & keyof AggregateTrip]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateTrip[P]>
      : GetScalarType<T[P], AggregateTrip[P]>
  }




  export type TripGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: TripWhereInput
    orderBy?: TripOrderByWithAggregationInput | TripOrderByWithAggregationInput[]
    by: TripScalarFieldEnum[] | TripScalarFieldEnum
    having?: TripScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: TripCountAggregateInputType | true
    _avg?: TripAvgAggregateInputType
    _sum?: TripSumAggregateInputType
    _min?: TripMinAggregateInputType
    _max?: TripMaxAggregateInputType
  }

  export type TripGroupByOutputType = {
    id: string
    riderId: string
    driverId: string | null
    status: string
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    estimatedFare: number
    actualFare: number | null
    paymentMethod: string
    paymentStatus: string
    promoCode: string | null
    promoDiscount: number
    distance: number | null
    duration: number | null
    requestedAt: Date
    matchedAt: Date | null
    startedAt: Date | null
    completedAt: Date | null
    cancelledAt: Date | null
    cancellationReason: string | null
    cancelledBy: string | null
    driverRating: number | null
    riderRating: number | null
    updatedAt: Date
    _count: TripCountAggregateOutputType | null
    _avg: TripAvgAggregateOutputType | null
    _sum: TripSumAggregateOutputType | null
    _min: TripMinAggregateOutputType | null
    _max: TripMaxAggregateOutputType | null
  }

  type GetTripGroupByPayload<T extends TripGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<TripGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof TripGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], TripGroupByOutputType[P]>
            : GetScalarType<T[P], TripGroupByOutputType[P]>
        }
      >
    >


  export type TripSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    riderId?: boolean
    driverId?: boolean
    status?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    pickupAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    dropoffAddress?: boolean
    estimatedFare?: boolean
    actualFare?: boolean
    paymentMethod?: boolean
    paymentStatus?: boolean
    promoCode?: boolean
    promoDiscount?: boolean
    distance?: boolean
    duration?: boolean
    requestedAt?: boolean
    matchedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancellationReason?: boolean
    cancelledBy?: boolean
    driverRating?: boolean
    riderRating?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["trip"]>

  export type TripSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    riderId?: boolean
    driverId?: boolean
    status?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    pickupAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    dropoffAddress?: boolean
    estimatedFare?: boolean
    actualFare?: boolean
    paymentMethod?: boolean
    paymentStatus?: boolean
    promoCode?: boolean
    promoDiscount?: boolean
    distance?: boolean
    duration?: boolean
    requestedAt?: boolean
    matchedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancellationReason?: boolean
    cancelledBy?: boolean
    driverRating?: boolean
    riderRating?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["trip"]>

  export type TripSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    riderId?: boolean
    driverId?: boolean
    status?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    pickupAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    dropoffAddress?: boolean
    estimatedFare?: boolean
    actualFare?: boolean
    paymentMethod?: boolean
    paymentStatus?: boolean
    promoCode?: boolean
    promoDiscount?: boolean
    distance?: boolean
    duration?: boolean
    requestedAt?: boolean
    matchedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancellationReason?: boolean
    cancelledBy?: boolean
    driverRating?: boolean
    riderRating?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["trip"]>

  export type TripSelectScalar = {
    id?: boolean
    riderId?: boolean
    driverId?: boolean
    status?: boolean
    pickupLat?: boolean
    pickupLng?: boolean
    pickupAddress?: boolean
    dropoffLat?: boolean
    dropoffLng?: boolean
    dropoffAddress?: boolean
    estimatedFare?: boolean
    actualFare?: boolean
    paymentMethod?: boolean
    paymentStatus?: boolean
    promoCode?: boolean
    promoDiscount?: boolean
    distance?: boolean
    duration?: boolean
    requestedAt?: boolean
    matchedAt?: boolean
    startedAt?: boolean
    completedAt?: boolean
    cancelledAt?: boolean
    cancellationReason?: boolean
    cancelledBy?: boolean
    driverRating?: boolean
    riderRating?: boolean
    updatedAt?: boolean
  }

  export type TripOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "riderId" | "driverId" | "status" | "pickupLat" | "pickupLng" | "pickupAddress" | "dropoffLat" | "dropoffLng" | "dropoffAddress" | "estimatedFare" | "actualFare" | "paymentMethod" | "paymentStatus" | "promoCode" | "promoDiscount" | "distance" | "duration" | "requestedAt" | "matchedAt" | "startedAt" | "completedAt" | "cancelledAt" | "cancellationReason" | "cancelledBy" | "driverRating" | "riderRating" | "updatedAt", ExtArgs["result"]["trip"]>

  export type $TripPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "Trip"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      riderId: string
      driverId: string | null
      status: string
      pickupLat: number
      pickupLng: number
      pickupAddress: string
      dropoffLat: number
      dropoffLng: number
      dropoffAddress: string
      estimatedFare: number
      actualFare: number | null
      paymentMethod: string
      paymentStatus: string
      promoCode: string | null
      promoDiscount: number
      distance: number | null
      duration: number | null
      requestedAt: Date
      matchedAt: Date | null
      startedAt: Date | null
      completedAt: Date | null
      cancelledAt: Date | null
      cancellationReason: string | null
      cancelledBy: string | null
      driverRating: number | null
      riderRating: number | null
      updatedAt: Date
    }, ExtArgs["result"]["trip"]>
    composites: {}
  }

  type TripGetPayload<S extends boolean | null | undefined | TripDefaultArgs> = $Result.GetResult<Prisma.$TripPayload, S>

  type TripCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<TripFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: TripCountAggregateInputType | true
    }

  export interface TripDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['Trip'], meta: { name: 'Trip' } }
    /**
     * Find zero or one Trip that matches the filter.
     * @param {TripFindUniqueArgs} args - Arguments to find a Trip
     * @example
     * // Get one Trip
     * const trip = await prisma.trip.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends TripFindUniqueArgs>(args: SelectSubset<T, TripFindUniqueArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one Trip that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {TripFindUniqueOrThrowArgs} args - Arguments to find a Trip
     * @example
     * // Get one Trip
     * const trip = await prisma.trip.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends TripFindUniqueOrThrowArgs>(args: SelectSubset<T, TripFindUniqueOrThrowArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Trip that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripFindFirstArgs} args - Arguments to find a Trip
     * @example
     * // Get one Trip
     * const trip = await prisma.trip.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends TripFindFirstArgs>(args?: SelectSubset<T, TripFindFirstArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first Trip that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripFindFirstOrThrowArgs} args - Arguments to find a Trip
     * @example
     * // Get one Trip
     * const trip = await prisma.trip.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends TripFindFirstOrThrowArgs>(args?: SelectSubset<T, TripFindFirstOrThrowArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more Trips that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all Trips
     * const trips = await prisma.trip.findMany()
     * 
     * // Get first 10 Trips
     * const trips = await prisma.trip.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const tripWithIdOnly = await prisma.trip.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends TripFindManyArgs>(args?: SelectSubset<T, TripFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a Trip.
     * @param {TripCreateArgs} args - Arguments to create a Trip.
     * @example
     * // Create one Trip
     * const Trip = await prisma.trip.create({
     *   data: {
     *     // ... data to create a Trip
     *   }
     * })
     * 
     */
    create<T extends TripCreateArgs>(args: SelectSubset<T, TripCreateArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many Trips.
     * @param {TripCreateManyArgs} args - Arguments to create many Trips.
     * @example
     * // Create many Trips
     * const trip = await prisma.trip.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends TripCreateManyArgs>(args?: SelectSubset<T, TripCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many Trips and returns the data saved in the database.
     * @param {TripCreateManyAndReturnArgs} args - Arguments to create many Trips.
     * @example
     * // Create many Trips
     * const trip = await prisma.trip.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many Trips and only return the `id`
     * const tripWithIdOnly = await prisma.trip.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends TripCreateManyAndReturnArgs>(args?: SelectSubset<T, TripCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a Trip.
     * @param {TripDeleteArgs} args - Arguments to delete one Trip.
     * @example
     * // Delete one Trip
     * const Trip = await prisma.trip.delete({
     *   where: {
     *     // ... filter to delete one Trip
     *   }
     * })
     * 
     */
    delete<T extends TripDeleteArgs>(args: SelectSubset<T, TripDeleteArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one Trip.
     * @param {TripUpdateArgs} args - Arguments to update one Trip.
     * @example
     * // Update one Trip
     * const trip = await prisma.trip.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends TripUpdateArgs>(args: SelectSubset<T, TripUpdateArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more Trips.
     * @param {TripDeleteManyArgs} args - Arguments to filter Trips to delete.
     * @example
     * // Delete a few Trips
     * const { count } = await prisma.trip.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends TripDeleteManyArgs>(args?: SelectSubset<T, TripDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Trips.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many Trips
     * const trip = await prisma.trip.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends TripUpdateManyArgs>(args: SelectSubset<T, TripUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more Trips and returns the data updated in the database.
     * @param {TripUpdateManyAndReturnArgs} args - Arguments to update many Trips.
     * @example
     * // Update many Trips
     * const trip = await prisma.trip.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more Trips and only return the `id`
     * const tripWithIdOnly = await prisma.trip.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends TripUpdateManyAndReturnArgs>(args: SelectSubset<T, TripUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one Trip.
     * @param {TripUpsertArgs} args - Arguments to update or create a Trip.
     * @example
     * // Update or create a Trip
     * const trip = await prisma.trip.upsert({
     *   create: {
     *     // ... data to create a Trip
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the Trip we want to update
     *   }
     * })
     */
    upsert<T extends TripUpsertArgs>(args: SelectSubset<T, TripUpsertArgs<ExtArgs>>): Prisma__TripClient<$Result.GetResult<Prisma.$TripPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of Trips.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripCountArgs} args - Arguments to filter Trips to count.
     * @example
     * // Count the number of Trips
     * const count = await prisma.trip.count({
     *   where: {
     *     // ... the filter for the Trips we want to count
     *   }
     * })
    **/
    count<T extends TripCountArgs>(
      args?: Subset<T, TripCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], TripCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a Trip.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends TripAggregateArgs>(args: Subset<T, TripAggregateArgs>): Prisma.PrismaPromise<GetTripAggregateType<T>>

    /**
     * Group by Trip.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {TripGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends TripGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: TripGroupByArgs['orderBy'] }
        : { orderBy?: TripGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, TripGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTripGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the Trip model
   */
  readonly fields: TripFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for Trip.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__TripClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the Trip model
   */
  interface TripFieldRefs {
    readonly id: FieldRef<"Trip", 'String'>
    readonly riderId: FieldRef<"Trip", 'String'>
    readonly driverId: FieldRef<"Trip", 'String'>
    readonly status: FieldRef<"Trip", 'String'>
    readonly pickupLat: FieldRef<"Trip", 'Float'>
    readonly pickupLng: FieldRef<"Trip", 'Float'>
    readonly pickupAddress: FieldRef<"Trip", 'String'>
    readonly dropoffLat: FieldRef<"Trip", 'Float'>
    readonly dropoffLng: FieldRef<"Trip", 'Float'>
    readonly dropoffAddress: FieldRef<"Trip", 'String'>
    readonly estimatedFare: FieldRef<"Trip", 'Float'>
    readonly actualFare: FieldRef<"Trip", 'Float'>
    readonly paymentMethod: FieldRef<"Trip", 'String'>
    readonly paymentStatus: FieldRef<"Trip", 'String'>
    readonly promoCode: FieldRef<"Trip", 'String'>
    readonly promoDiscount: FieldRef<"Trip", 'Float'>
    readonly distance: FieldRef<"Trip", 'Float'>
    readonly duration: FieldRef<"Trip", 'Int'>
    readonly requestedAt: FieldRef<"Trip", 'DateTime'>
    readonly matchedAt: FieldRef<"Trip", 'DateTime'>
    readonly startedAt: FieldRef<"Trip", 'DateTime'>
    readonly completedAt: FieldRef<"Trip", 'DateTime'>
    readonly cancelledAt: FieldRef<"Trip", 'DateTime'>
    readonly cancellationReason: FieldRef<"Trip", 'String'>
    readonly cancelledBy: FieldRef<"Trip", 'String'>
    readonly driverRating: FieldRef<"Trip", 'Float'>
    readonly riderRating: FieldRef<"Trip", 'Float'>
    readonly updatedAt: FieldRef<"Trip", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * Trip findUnique
   */
  export type TripFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter, which Trip to fetch.
     */
    where: TripWhereUniqueInput
  }

  /**
   * Trip findUniqueOrThrow
   */
  export type TripFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter, which Trip to fetch.
     */
    where: TripWhereUniqueInput
  }

  /**
   * Trip findFirst
   */
  export type TripFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter, which Trip to fetch.
     */
    where?: TripWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Trips to fetch.
     */
    orderBy?: TripOrderByWithRelationInput | TripOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Trips.
     */
    cursor?: TripWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Trips from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Trips.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Trips.
     */
    distinct?: TripScalarFieldEnum | TripScalarFieldEnum[]
  }

  /**
   * Trip findFirstOrThrow
   */
  export type TripFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter, which Trip to fetch.
     */
    where?: TripWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Trips to fetch.
     */
    orderBy?: TripOrderByWithRelationInput | TripOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for Trips.
     */
    cursor?: TripWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Trips from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Trips.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Trips.
     */
    distinct?: TripScalarFieldEnum | TripScalarFieldEnum[]
  }

  /**
   * Trip findMany
   */
  export type TripFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter, which Trips to fetch.
     */
    where?: TripWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of Trips to fetch.
     */
    orderBy?: TripOrderByWithRelationInput | TripOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing Trips.
     */
    cursor?: TripWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` Trips from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` Trips.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of Trips.
     */
    distinct?: TripScalarFieldEnum | TripScalarFieldEnum[]
  }

  /**
   * Trip create
   */
  export type TripCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * The data needed to create a Trip.
     */
    data: XOR<TripCreateInput, TripUncheckedCreateInput>
  }

  /**
   * Trip createMany
   */
  export type TripCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many Trips.
     */
    data: TripCreateManyInput | TripCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Trip createManyAndReturn
   */
  export type TripCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * The data used to create many Trips.
     */
    data: TripCreateManyInput | TripCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * Trip update
   */
  export type TripUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * The data needed to update a Trip.
     */
    data: XOR<TripUpdateInput, TripUncheckedUpdateInput>
    /**
     * Choose, which Trip to update.
     */
    where: TripWhereUniqueInput
  }

  /**
   * Trip updateMany
   */
  export type TripUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update Trips.
     */
    data: XOR<TripUpdateManyMutationInput, TripUncheckedUpdateManyInput>
    /**
     * Filter which Trips to update
     */
    where?: TripWhereInput
    /**
     * Limit how many Trips to update.
     */
    limit?: number
  }

  /**
   * Trip updateManyAndReturn
   */
  export type TripUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * The data used to update Trips.
     */
    data: XOR<TripUpdateManyMutationInput, TripUncheckedUpdateManyInput>
    /**
     * Filter which Trips to update
     */
    where?: TripWhereInput
    /**
     * Limit how many Trips to update.
     */
    limit?: number
  }

  /**
   * Trip upsert
   */
  export type TripUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * The filter to search for the Trip to update in case it exists.
     */
    where: TripWhereUniqueInput
    /**
     * In case the Trip found by the `where` argument doesn't exist, create a new Trip with this data.
     */
    create: XOR<TripCreateInput, TripUncheckedCreateInput>
    /**
     * In case the Trip was found with the provided `where` argument, update it with this data.
     */
    update: XOR<TripUpdateInput, TripUncheckedUpdateInput>
  }

  /**
   * Trip delete
   */
  export type TripDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
    /**
     * Filter which Trip to delete.
     */
    where: TripWhereUniqueInput
  }

  /**
   * Trip deleteMany
   */
  export type TripDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which Trips to delete
     */
    where?: TripWhereInput
    /**
     * Limit how many Trips to delete.
     */
    limit?: number
  }

  /**
   * Trip without action
   */
  export type TripDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the Trip
     */
    select?: TripSelect<ExtArgs> | null
    /**
     * Omit specific fields from the Trip
     */
    omit?: TripOmit<ExtArgs> | null
  }


  /**
   * Model SOS
   */

  export type AggregateSOS = {
    _count: SOSCountAggregateOutputType | null
    _avg: SOSAvgAggregateOutputType | null
    _sum: SOSSumAggregateOutputType | null
    _min: SOSMinAggregateOutputType | null
    _max: SOSMaxAggregateOutputType | null
  }

  export type SOSAvgAggregateOutputType = {
    lat: number | null
    lng: number | null
  }

  export type SOSSumAggregateOutputType = {
    lat: number | null
    lng: number | null
  }

  export type SOSMinAggregateOutputType = {
    id: string | null
    tripId: string | null
    userId: string | null
    userType: string | null
    lat: number | null
    lng: number | null
    reason: string | null
    status: string | null
    resolution: string | null
    resolvedBy: string | null
    resolvedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SOSMaxAggregateOutputType = {
    id: string | null
    tripId: string | null
    userId: string | null
    userType: string | null
    lat: number | null
    lng: number | null
    reason: string | null
    status: string | null
    resolution: string | null
    resolvedBy: string | null
    resolvedAt: Date | null
    createdAt: Date | null
    updatedAt: Date | null
  }

  export type SOSCountAggregateOutputType = {
    id: number
    tripId: number
    userId: number
    userType: number
    lat: number
    lng: number
    reason: number
    status: number
    resolution: number
    resolvedBy: number
    resolvedAt: number
    createdAt: number
    updatedAt: number
    _all: number
  }


  export type SOSAvgAggregateInputType = {
    lat?: true
    lng?: true
  }

  export type SOSSumAggregateInputType = {
    lat?: true
    lng?: true
  }

  export type SOSMinAggregateInputType = {
    id?: true
    tripId?: true
    userId?: true
    userType?: true
    lat?: true
    lng?: true
    reason?: true
    status?: true
    resolution?: true
    resolvedBy?: true
    resolvedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SOSMaxAggregateInputType = {
    id?: true
    tripId?: true
    userId?: true
    userType?: true
    lat?: true
    lng?: true
    reason?: true
    status?: true
    resolution?: true
    resolvedBy?: true
    resolvedAt?: true
    createdAt?: true
    updatedAt?: true
  }

  export type SOSCountAggregateInputType = {
    id?: true
    tripId?: true
    userId?: true
    userType?: true
    lat?: true
    lng?: true
    reason?: true
    status?: true
    resolution?: true
    resolvedBy?: true
    resolvedAt?: true
    createdAt?: true
    updatedAt?: true
    _all?: true
  }

  export type SOSAggregateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SOS to aggregate.
     */
    where?: SOSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SOS to fetch.
     */
    orderBy?: SOSOrderByWithRelationInput | SOSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the start position
     */
    cursor?: SOSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SOS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SOS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Count returned SOS
    **/
    _count?: true | SOSCountAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to average
    **/
    _avg?: SOSAvgAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to sum
    **/
    _sum?: SOSSumAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the minimum value
    **/
    _min?: SOSMinAggregateInputType
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/aggregations Aggregation Docs}
     * 
     * Select which fields to find the maximum value
    **/
    _max?: SOSMaxAggregateInputType
  }

  export type GetSOSAggregateType<T extends SOSAggregateArgs> = {
        [P in keyof T & keyof AggregateSOS]: P extends '_count' | 'count'
      ? T[P] extends true
        ? number
        : GetScalarType<T[P], AggregateSOS[P]>
      : GetScalarType<T[P], AggregateSOS[P]>
  }




  export type SOSGroupByArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    where?: SOSWhereInput
    orderBy?: SOSOrderByWithAggregationInput | SOSOrderByWithAggregationInput[]
    by: SOSScalarFieldEnum[] | SOSScalarFieldEnum
    having?: SOSScalarWhereWithAggregatesInput
    take?: number
    skip?: number
    _count?: SOSCountAggregateInputType | true
    _avg?: SOSAvgAggregateInputType
    _sum?: SOSSumAggregateInputType
    _min?: SOSMinAggregateInputType
    _max?: SOSMaxAggregateInputType
  }

  export type SOSGroupByOutputType = {
    id: string
    tripId: string | null
    userId: string
    userType: string
    lat: number
    lng: number
    reason: string | null
    status: string
    resolution: string | null
    resolvedBy: string | null
    resolvedAt: Date | null
    createdAt: Date
    updatedAt: Date
    _count: SOSCountAggregateOutputType | null
    _avg: SOSAvgAggregateOutputType | null
    _sum: SOSSumAggregateOutputType | null
    _min: SOSMinAggregateOutputType | null
    _max: SOSMaxAggregateOutputType | null
  }

  type GetSOSGroupByPayload<T extends SOSGroupByArgs> = Prisma.PrismaPromise<
    Array<
      PickEnumerable<SOSGroupByOutputType, T['by']> &
        {
          [P in ((keyof T) & (keyof SOSGroupByOutputType))]: P extends '_count'
            ? T[P] extends boolean
              ? number
              : GetScalarType<T[P], SOSGroupByOutputType[P]>
            : GetScalarType<T[P], SOSGroupByOutputType[P]>
        }
      >
    >


  export type SOSSelect<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tripId?: boolean
    userId?: boolean
    userType?: boolean
    lat?: boolean
    lng?: boolean
    reason?: boolean
    status?: boolean
    resolution?: boolean
    resolvedBy?: boolean
    resolvedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sOS"]>

  export type SOSSelectCreateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tripId?: boolean
    userId?: boolean
    userType?: boolean
    lat?: boolean
    lng?: boolean
    reason?: boolean
    status?: boolean
    resolution?: boolean
    resolvedBy?: boolean
    resolvedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sOS"]>

  export type SOSSelectUpdateManyAndReturn<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetSelect<{
    id?: boolean
    tripId?: boolean
    userId?: boolean
    userType?: boolean
    lat?: boolean
    lng?: boolean
    reason?: boolean
    status?: boolean
    resolution?: boolean
    resolvedBy?: boolean
    resolvedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }, ExtArgs["result"]["sOS"]>

  export type SOSSelectScalar = {
    id?: boolean
    tripId?: boolean
    userId?: boolean
    userType?: boolean
    lat?: boolean
    lng?: boolean
    reason?: boolean
    status?: boolean
    resolution?: boolean
    resolvedBy?: boolean
    resolvedAt?: boolean
    createdAt?: boolean
    updatedAt?: boolean
  }

  export type SOSOmit<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = $Extensions.GetOmit<"id" | "tripId" | "userId" | "userType" | "lat" | "lng" | "reason" | "status" | "resolution" | "resolvedBy" | "resolvedAt" | "createdAt" | "updatedAt", ExtArgs["result"]["sOS"]>

  export type $SOSPayload<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    name: "SOS"
    objects: {}
    scalars: $Extensions.GetPayloadResult<{
      id: string
      tripId: string | null
      userId: string
      userType: string
      lat: number
      lng: number
      reason: string | null
      status: string
      resolution: string | null
      resolvedBy: string | null
      resolvedAt: Date | null
      createdAt: Date
      updatedAt: Date
    }, ExtArgs["result"]["sOS"]>
    composites: {}
  }

  type SOSGetPayload<S extends boolean | null | undefined | SOSDefaultArgs> = $Result.GetResult<Prisma.$SOSPayload, S>

  type SOSCountArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> =
    Omit<SOSFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
      select?: SOSCountAggregateInputType | true
    }

  export interface SOSDelegate<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: { types: Prisma.TypeMap<ExtArgs>['model']['SOS'], meta: { name: 'SOS' } }
    /**
     * Find zero or one SOS that matches the filter.
     * @param {SOSFindUniqueArgs} args - Arguments to find a SOS
     * @example
     * // Get one SOS
     * const sOS = await prisma.sOS.findUnique({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUnique<T extends SOSFindUniqueArgs>(args: SelectSubset<T, SOSFindUniqueArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find one SOS that matches the filter or throw an error with `error.code='P2025'`
     * if no matches were found.
     * @param {SOSFindUniqueOrThrowArgs} args - Arguments to find a SOS
     * @example
     * // Get one SOS
     * const sOS = await prisma.sOS.findUniqueOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findUniqueOrThrow<T extends SOSFindUniqueOrThrowArgs>(args: SelectSubset<T, SOSFindUniqueOrThrowArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SOS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSFindFirstArgs} args - Arguments to find a SOS
     * @example
     * // Get one SOS
     * const sOS = await prisma.sOS.findFirst({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirst<T extends SOSFindFirstArgs>(args?: SelectSubset<T, SOSFindFirstArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>

    /**
     * Find the first SOS that matches the filter or
     * throw `PrismaKnownClientError` with `P2025` code if no matches were found.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSFindFirstOrThrowArgs} args - Arguments to find a SOS
     * @example
     * // Get one SOS
     * const sOS = await prisma.sOS.findFirstOrThrow({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     */
    findFirstOrThrow<T extends SOSFindFirstOrThrowArgs>(args?: SelectSubset<T, SOSFindFirstOrThrowArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Find zero or more SOS that matches the filter.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSFindManyArgs} args - Arguments to filter and select certain fields only.
     * @example
     * // Get all SOS
     * const sOS = await prisma.sOS.findMany()
     * 
     * // Get first 10 SOS
     * const sOS = await prisma.sOS.findMany({ take: 10 })
     * 
     * // Only select the `id`
     * const sOSWithIdOnly = await prisma.sOS.findMany({ select: { id: true } })
     * 
     */
    findMany<T extends SOSFindManyArgs>(args?: SelectSubset<T, SOSFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>

    /**
     * Create a SOS.
     * @param {SOSCreateArgs} args - Arguments to create a SOS.
     * @example
     * // Create one SOS
     * const SOS = await prisma.sOS.create({
     *   data: {
     *     // ... data to create a SOS
     *   }
     * })
     * 
     */
    create<T extends SOSCreateArgs>(args: SelectSubset<T, SOSCreateArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Create many SOS.
     * @param {SOSCreateManyArgs} args - Arguments to create many SOS.
     * @example
     * // Create many SOS
     * const sOS = await prisma.sOS.createMany({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     *     
     */
    createMany<T extends SOSCreateManyArgs>(args?: SelectSubset<T, SOSCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Create many SOS and returns the data saved in the database.
     * @param {SOSCreateManyAndReturnArgs} args - Arguments to create many SOS.
     * @example
     * // Create many SOS
     * const sOS = await prisma.sOS.createManyAndReturn({
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Create many SOS and only return the `id`
     * const sOSWithIdOnly = await prisma.sOS.createManyAndReturn({
     *   select: { id: true },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    createManyAndReturn<T extends SOSCreateManyAndReturnArgs>(args?: SelectSubset<T, SOSCreateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "createManyAndReturn", GlobalOmitOptions>>

    /**
     * Delete a SOS.
     * @param {SOSDeleteArgs} args - Arguments to delete one SOS.
     * @example
     * // Delete one SOS
     * const SOS = await prisma.sOS.delete({
     *   where: {
     *     // ... filter to delete one SOS
     *   }
     * })
     * 
     */
    delete<T extends SOSDeleteArgs>(args: SelectSubset<T, SOSDeleteArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Update one SOS.
     * @param {SOSUpdateArgs} args - Arguments to update one SOS.
     * @example
     * // Update one SOS
     * const sOS = await prisma.sOS.update({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    update<T extends SOSUpdateArgs>(args: SelectSubset<T, SOSUpdateArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>

    /**
     * Delete zero or more SOS.
     * @param {SOSDeleteManyArgs} args - Arguments to filter SOS to delete.
     * @example
     * // Delete a few SOS
     * const { count } = await prisma.sOS.deleteMany({
     *   where: {
     *     // ... provide filter here
     *   }
     * })
     * 
     */
    deleteMany<T extends SOSDeleteManyArgs>(args?: SelectSubset<T, SOSDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SOS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSUpdateManyArgs} args - Arguments to update one or more rows.
     * @example
     * // Update many SOS
     * const sOS = await prisma.sOS.updateMany({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: {
     *     // ... provide data here
     *   }
     * })
     * 
     */
    updateMany<T extends SOSUpdateManyArgs>(args: SelectSubset<T, SOSUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<BatchPayload>

    /**
     * Update zero or more SOS and returns the data updated in the database.
     * @param {SOSUpdateManyAndReturnArgs} args - Arguments to update many SOS.
     * @example
     * // Update many SOS
     * const sOS = await prisma.sOS.updateManyAndReturn({
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * 
     * // Update zero or more SOS and only return the `id`
     * const sOSWithIdOnly = await prisma.sOS.updateManyAndReturn({
     *   select: { id: true },
     *   where: {
     *     // ... provide filter here
     *   },
     *   data: [
     *     // ... provide data here
     *   ]
     * })
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * 
     */
    updateManyAndReturn<T extends SOSUpdateManyAndReturnArgs>(args: SelectSubset<T, SOSUpdateManyAndReturnArgs<ExtArgs>>): Prisma.PrismaPromise<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "updateManyAndReturn", GlobalOmitOptions>>

    /**
     * Create or update one SOS.
     * @param {SOSUpsertArgs} args - Arguments to update or create a SOS.
     * @example
     * // Update or create a SOS
     * const sOS = await prisma.sOS.upsert({
     *   create: {
     *     // ... data to create a SOS
     *   },
     *   update: {
     *     // ... in case it already exists, update
     *   },
     *   where: {
     *     // ... the filter for the SOS we want to update
     *   }
     * })
     */
    upsert<T extends SOSUpsertArgs>(args: SelectSubset<T, SOSUpsertArgs<ExtArgs>>): Prisma__SOSClient<$Result.GetResult<Prisma.$SOSPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>


    /**
     * Count the number of SOS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSCountArgs} args - Arguments to filter SOS to count.
     * @example
     * // Count the number of SOS
     * const count = await prisma.sOS.count({
     *   where: {
     *     // ... the filter for the SOS we want to count
     *   }
     * })
    **/
    count<T extends SOSCountArgs>(
      args?: Subset<T, SOSCountArgs>,
    ): Prisma.PrismaPromise<
      T extends $Utils.Record<'select', any>
        ? T['select'] extends true
          ? number
          : GetScalarType<T['select'], SOSCountAggregateOutputType>
        : number
    >

    /**
     * Allows you to perform aggregations operations on a SOS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSAggregateArgs} args - Select which aggregations you would like to apply and on what fields.
     * @example
     * // Ordered by age ascending
     * // Where email contains prisma.io
     * // Limited to the 10 users
     * const aggregations = await prisma.user.aggregate({
     *   _avg: {
     *     age: true,
     *   },
     *   where: {
     *     email: {
     *       contains: "prisma.io",
     *     },
     *   },
     *   orderBy: {
     *     age: "asc",
     *   },
     *   take: 10,
     * })
    **/
    aggregate<T extends SOSAggregateArgs>(args: Subset<T, SOSAggregateArgs>): Prisma.PrismaPromise<GetSOSAggregateType<T>>

    /**
     * Group by SOS.
     * Note, that providing `undefined` is treated as the value not being there.
     * Read more here: https://pris.ly/d/null-undefined
     * @param {SOSGroupByArgs} args - Group by arguments.
     * @example
     * // Group by city, order by createdAt, get count
     * const result = await prisma.user.groupBy({
     *   by: ['city', 'createdAt'],
     *   orderBy: {
     *     createdAt: true
     *   },
     *   _count: {
     *     _all: true
     *   },
     * })
     * 
    **/
    groupBy<
      T extends SOSGroupByArgs,
      HasSelectOrTake extends Or<
        Extends<'skip', Keys<T>>,
        Extends<'take', Keys<T>>
      >,
      OrderByArg extends True extends HasSelectOrTake
        ? { orderBy: SOSGroupByArgs['orderBy'] }
        : { orderBy?: SOSGroupByArgs['orderBy'] },
      OrderFields extends ExcludeUnderscoreKeys<Keys<MaybeTupleToUnion<T['orderBy']>>>,
      ByFields extends MaybeTupleToUnion<T['by']>,
      ByValid extends Has<ByFields, OrderFields>,
      HavingFields extends GetHavingFields<T['having']>,
      HavingValid extends Has<ByFields, HavingFields>,
      ByEmpty extends T['by'] extends never[] ? True : False,
      InputErrors extends ByEmpty extends True
      ? `Error: "by" must not be empty.`
      : HavingValid extends False
      ? {
          [P in HavingFields]: P extends ByFields
            ? never
            : P extends string
            ? `Error: Field "${P}" used in "having" needs to be provided in "by".`
            : [
                Error,
                'Field ',
                P,
                ` in "having" needs to be provided in "by"`,
              ]
        }[HavingFields]
      : 'take' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "take", you also need to provide "orderBy"'
      : 'skip' extends Keys<T>
      ? 'orderBy' extends Keys<T>
        ? ByValid extends True
          ? {}
          : {
              [P in OrderFields]: P extends ByFields
                ? never
                : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
            }[OrderFields]
        : 'Error: If you provide "skip", you also need to provide "orderBy"'
      : ByValid extends True
      ? {}
      : {
          [P in OrderFields]: P extends ByFields
            ? never
            : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`
        }[OrderFields]
    >(args: SubsetIntersection<T, SOSGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetSOSGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>
  /**
   * Fields of the SOS model
   */
  readonly fields: SOSFieldRefs;
  }

  /**
   * The delegate class that acts as a "Promise-like" for SOS.
   * Why is this prefixed with `Prisma__`?
   * Because we want to prevent naming conflicts as mentioned in
   * https://github.com/prisma/prisma-client-js/issues/707
   */
  export interface Prisma__SOSClient<T, Null = never, ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise"
    /**
     * Attaches callbacks for the resolution and/or rejection of the Promise.
     * @param onfulfilled The callback to execute when the Promise is resolved.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of which ever callback is executed.
     */
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): $Utils.JsPromise<TResult1 | TResult2>
    /**
     * Attaches a callback for only the rejection of the Promise.
     * @param onrejected The callback to execute when the Promise is rejected.
     * @returns A Promise for the completion of the callback.
     */
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): $Utils.JsPromise<T | TResult>
    /**
     * Attaches a callback that is invoked when the Promise is settled (fulfilled or rejected). The
     * resolved value cannot be modified from the callback.
     * @param onfinally The callback to execute when the Promise is settled (fulfilled or rejected).
     * @returns A Promise for the completion of the callback.
     */
    finally(onfinally?: (() => void) | undefined | null): $Utils.JsPromise<T>
  }




  /**
   * Fields of the SOS model
   */
  interface SOSFieldRefs {
    readonly id: FieldRef<"SOS", 'String'>
    readonly tripId: FieldRef<"SOS", 'String'>
    readonly userId: FieldRef<"SOS", 'String'>
    readonly userType: FieldRef<"SOS", 'String'>
    readonly lat: FieldRef<"SOS", 'Float'>
    readonly lng: FieldRef<"SOS", 'Float'>
    readonly reason: FieldRef<"SOS", 'String'>
    readonly status: FieldRef<"SOS", 'String'>
    readonly resolution: FieldRef<"SOS", 'String'>
    readonly resolvedBy: FieldRef<"SOS", 'String'>
    readonly resolvedAt: FieldRef<"SOS", 'DateTime'>
    readonly createdAt: FieldRef<"SOS", 'DateTime'>
    readonly updatedAt: FieldRef<"SOS", 'DateTime'>
  }
    

  // Custom InputTypes
  /**
   * SOS findUnique
   */
  export type SOSFindUniqueArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter, which SOS to fetch.
     */
    where: SOSWhereUniqueInput
  }

  /**
   * SOS findUniqueOrThrow
   */
  export type SOSFindUniqueOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter, which SOS to fetch.
     */
    where: SOSWhereUniqueInput
  }

  /**
   * SOS findFirst
   */
  export type SOSFindFirstArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter, which SOS to fetch.
     */
    where?: SOSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SOS to fetch.
     */
    orderBy?: SOSOrderByWithRelationInput | SOSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SOS.
     */
    cursor?: SOSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SOS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SOS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SOS.
     */
    distinct?: SOSScalarFieldEnum | SOSScalarFieldEnum[]
  }

  /**
   * SOS findFirstOrThrow
   */
  export type SOSFindFirstOrThrowArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter, which SOS to fetch.
     */
    where?: SOSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SOS to fetch.
     */
    orderBy?: SOSOrderByWithRelationInput | SOSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for searching for SOS.
     */
    cursor?: SOSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SOS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SOS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SOS.
     */
    distinct?: SOSScalarFieldEnum | SOSScalarFieldEnum[]
  }

  /**
   * SOS findMany
   */
  export type SOSFindManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter, which SOS to fetch.
     */
    where?: SOSWhereInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/sorting Sorting Docs}
     * 
     * Determine the order of SOS to fetch.
     */
    orderBy?: SOSOrderByWithRelationInput | SOSOrderByWithRelationInput[]
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination#cursor-based-pagination Cursor Docs}
     * 
     * Sets the position for listing SOS.
     */
    cursor?: SOSWhereUniqueInput
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Take `±n` SOS from the position of the cursor.
     */
    take?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/pagination Pagination Docs}
     * 
     * Skip the first `n` SOS.
     */
    skip?: number
    /**
     * {@link https://www.prisma.io/docs/concepts/components/prisma-client/distinct Distinct Docs}
     * 
     * Filter by unique combinations of SOS.
     */
    distinct?: SOSScalarFieldEnum | SOSScalarFieldEnum[]
  }

  /**
   * SOS create
   */
  export type SOSCreateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * The data needed to create a SOS.
     */
    data: XOR<SOSCreateInput, SOSUncheckedCreateInput>
  }

  /**
   * SOS createMany
   */
  export type SOSCreateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to create many SOS.
     */
    data: SOSCreateManyInput | SOSCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SOS createManyAndReturn
   */
  export type SOSCreateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelectCreateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * The data used to create many SOS.
     */
    data: SOSCreateManyInput | SOSCreateManyInput[]
    skipDuplicates?: boolean
  }

  /**
   * SOS update
   */
  export type SOSUpdateArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * The data needed to update a SOS.
     */
    data: XOR<SOSUpdateInput, SOSUncheckedUpdateInput>
    /**
     * Choose, which SOS to update.
     */
    where: SOSWhereUniqueInput
  }

  /**
   * SOS updateMany
   */
  export type SOSUpdateManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * The data used to update SOS.
     */
    data: XOR<SOSUpdateManyMutationInput, SOSUncheckedUpdateManyInput>
    /**
     * Filter which SOS to update
     */
    where?: SOSWhereInput
    /**
     * Limit how many SOS to update.
     */
    limit?: number
  }

  /**
   * SOS updateManyAndReturn
   */
  export type SOSUpdateManyAndReturnArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelectUpdateManyAndReturn<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * The data used to update SOS.
     */
    data: XOR<SOSUpdateManyMutationInput, SOSUncheckedUpdateManyInput>
    /**
     * Filter which SOS to update
     */
    where?: SOSWhereInput
    /**
     * Limit how many SOS to update.
     */
    limit?: number
  }

  /**
   * SOS upsert
   */
  export type SOSUpsertArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * The filter to search for the SOS to update in case it exists.
     */
    where: SOSWhereUniqueInput
    /**
     * In case the SOS found by the `where` argument doesn't exist, create a new SOS with this data.
     */
    create: XOR<SOSCreateInput, SOSUncheckedCreateInput>
    /**
     * In case the SOS was found with the provided `where` argument, update it with this data.
     */
    update: XOR<SOSUpdateInput, SOSUncheckedUpdateInput>
  }

  /**
   * SOS delete
   */
  export type SOSDeleteArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
    /**
     * Filter which SOS to delete.
     */
    where: SOSWhereUniqueInput
  }

  /**
   * SOS deleteMany
   */
  export type SOSDeleteManyArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Filter which SOS to delete
     */
    where?: SOSWhereInput
    /**
     * Limit how many SOS to delete.
     */
    limit?: number
  }

  /**
   * SOS without action
   */
  export type SOSDefaultArgs<ExtArgs extends $Extensions.InternalArgs = $Extensions.DefaultArgs> = {
    /**
     * Select specific fields to fetch from the SOS
     */
    select?: SOSSelect<ExtArgs> | null
    /**
     * Omit specific fields from the SOS
     */
    omit?: SOSOmit<ExtArgs> | null
  }


  /**
   * Enums
   */

  export const TransactionIsolationLevel: {
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
  };

  export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel]


  export const TripScalarFieldEnum: {
    id: 'id',
    riderId: 'riderId',
    driverId: 'driverId',
    status: 'status',
    pickupLat: 'pickupLat',
    pickupLng: 'pickupLng',
    pickupAddress: 'pickupAddress',
    dropoffLat: 'dropoffLat',
    dropoffLng: 'dropoffLng',
    dropoffAddress: 'dropoffAddress',
    estimatedFare: 'estimatedFare',
    actualFare: 'actualFare',
    paymentMethod: 'paymentMethod',
    paymentStatus: 'paymentStatus',
    promoCode: 'promoCode',
    promoDiscount: 'promoDiscount',
    distance: 'distance',
    duration: 'duration',
    requestedAt: 'requestedAt',
    matchedAt: 'matchedAt',
    startedAt: 'startedAt',
    completedAt: 'completedAt',
    cancelledAt: 'cancelledAt',
    cancellationReason: 'cancellationReason',
    cancelledBy: 'cancelledBy',
    driverRating: 'driverRating',
    riderRating: 'riderRating',
    updatedAt: 'updatedAt'
  };

  export type TripScalarFieldEnum = (typeof TripScalarFieldEnum)[keyof typeof TripScalarFieldEnum]


  export const SOSScalarFieldEnum: {
    id: 'id',
    tripId: 'tripId',
    userId: 'userId',
    userType: 'userType',
    lat: 'lat',
    lng: 'lng',
    reason: 'reason',
    status: 'status',
    resolution: 'resolution',
    resolvedBy: 'resolvedBy',
    resolvedAt: 'resolvedAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
  };

  export type SOSScalarFieldEnum = (typeof SOSScalarFieldEnum)[keyof typeof SOSScalarFieldEnum]


  export const SortOrder: {
    asc: 'asc',
    desc: 'desc'
  };

  export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder]


  export const QueryMode: {
    default: 'default',
    insensitive: 'insensitive'
  };

  export type QueryMode = (typeof QueryMode)[keyof typeof QueryMode]


  export const NullsOrder: {
    first: 'first',
    last: 'last'
  };

  export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder]


  /**
   * Field references
   */


  /**
   * Reference to a field of type 'String'
   */
  export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>
    


  /**
   * Reference to a field of type 'String[]'
   */
  export type ListStringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String[]'>
    


  /**
   * Reference to a field of type 'Float'
   */
  export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>
    


  /**
   * Reference to a field of type 'Float[]'
   */
  export type ListFloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float[]'>
    


  /**
   * Reference to a field of type 'Int'
   */
  export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>
    


  /**
   * Reference to a field of type 'Int[]'
   */
  export type ListIntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int[]'>
    


  /**
   * Reference to a field of type 'DateTime'
   */
  export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>
    


  /**
   * Reference to a field of type 'DateTime[]'
   */
  export type ListDateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime[]'>
    
  /**
   * Deep Input Types
   */


  export type TripWhereInput = {
    AND?: TripWhereInput | TripWhereInput[]
    OR?: TripWhereInput[]
    NOT?: TripWhereInput | TripWhereInput[]
    id?: StringFilter<"Trip"> | string
    riderId?: StringFilter<"Trip"> | string
    driverId?: StringNullableFilter<"Trip"> | string | null
    status?: StringFilter<"Trip"> | string
    pickupLat?: FloatFilter<"Trip"> | number
    pickupLng?: FloatFilter<"Trip"> | number
    pickupAddress?: StringFilter<"Trip"> | string
    dropoffLat?: FloatFilter<"Trip"> | number
    dropoffLng?: FloatFilter<"Trip"> | number
    dropoffAddress?: StringFilter<"Trip"> | string
    estimatedFare?: FloatFilter<"Trip"> | number
    actualFare?: FloatNullableFilter<"Trip"> | number | null
    paymentMethod?: StringFilter<"Trip"> | string
    paymentStatus?: StringFilter<"Trip"> | string
    promoCode?: StringNullableFilter<"Trip"> | string | null
    promoDiscount?: FloatFilter<"Trip"> | number
    distance?: FloatNullableFilter<"Trip"> | number | null
    duration?: IntNullableFilter<"Trip"> | number | null
    requestedAt?: DateTimeFilter<"Trip"> | Date | string
    matchedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    startedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    cancelledAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    cancellationReason?: StringNullableFilter<"Trip"> | string | null
    cancelledBy?: StringNullableFilter<"Trip"> | string | null
    driverRating?: FloatNullableFilter<"Trip"> | number | null
    riderRating?: FloatNullableFilter<"Trip"> | number | null
    updatedAt?: DateTimeFilter<"Trip"> | Date | string
  }

  export type TripOrderByWithRelationInput = {
    id?: SortOrder
    riderId?: SortOrder
    driverId?: SortOrderInput | SortOrder
    status?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    pickupAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    dropoffAddress?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrderInput | SortOrder
    paymentMethod?: SortOrder
    paymentStatus?: SortOrder
    promoCode?: SortOrderInput | SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    requestedAt?: SortOrder
    matchedAt?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    cancelledAt?: SortOrderInput | SortOrder
    cancellationReason?: SortOrderInput | SortOrder
    cancelledBy?: SortOrderInput | SortOrder
    driverRating?: SortOrderInput | SortOrder
    riderRating?: SortOrderInput | SortOrder
    updatedAt?: SortOrder
  }

  export type TripWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: TripWhereInput | TripWhereInput[]
    OR?: TripWhereInput[]
    NOT?: TripWhereInput | TripWhereInput[]
    riderId?: StringFilter<"Trip"> | string
    driverId?: StringNullableFilter<"Trip"> | string | null
    status?: StringFilter<"Trip"> | string
    pickupLat?: FloatFilter<"Trip"> | number
    pickupLng?: FloatFilter<"Trip"> | number
    pickupAddress?: StringFilter<"Trip"> | string
    dropoffLat?: FloatFilter<"Trip"> | number
    dropoffLng?: FloatFilter<"Trip"> | number
    dropoffAddress?: StringFilter<"Trip"> | string
    estimatedFare?: FloatFilter<"Trip"> | number
    actualFare?: FloatNullableFilter<"Trip"> | number | null
    paymentMethod?: StringFilter<"Trip"> | string
    paymentStatus?: StringFilter<"Trip"> | string
    promoCode?: StringNullableFilter<"Trip"> | string | null
    promoDiscount?: FloatFilter<"Trip"> | number
    distance?: FloatNullableFilter<"Trip"> | number | null
    duration?: IntNullableFilter<"Trip"> | number | null
    requestedAt?: DateTimeFilter<"Trip"> | Date | string
    matchedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    startedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    completedAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    cancelledAt?: DateTimeNullableFilter<"Trip"> | Date | string | null
    cancellationReason?: StringNullableFilter<"Trip"> | string | null
    cancelledBy?: StringNullableFilter<"Trip"> | string | null
    driverRating?: FloatNullableFilter<"Trip"> | number | null
    riderRating?: FloatNullableFilter<"Trip"> | number | null
    updatedAt?: DateTimeFilter<"Trip"> | Date | string
  }, "id">

  export type TripOrderByWithAggregationInput = {
    id?: SortOrder
    riderId?: SortOrder
    driverId?: SortOrderInput | SortOrder
    status?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    pickupAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    dropoffAddress?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrderInput | SortOrder
    paymentMethod?: SortOrder
    paymentStatus?: SortOrder
    promoCode?: SortOrderInput | SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrderInput | SortOrder
    duration?: SortOrderInput | SortOrder
    requestedAt?: SortOrder
    matchedAt?: SortOrderInput | SortOrder
    startedAt?: SortOrderInput | SortOrder
    completedAt?: SortOrderInput | SortOrder
    cancelledAt?: SortOrderInput | SortOrder
    cancellationReason?: SortOrderInput | SortOrder
    cancelledBy?: SortOrderInput | SortOrder
    driverRating?: SortOrderInput | SortOrder
    riderRating?: SortOrderInput | SortOrder
    updatedAt?: SortOrder
    _count?: TripCountOrderByAggregateInput
    _avg?: TripAvgOrderByAggregateInput
    _max?: TripMaxOrderByAggregateInput
    _min?: TripMinOrderByAggregateInput
    _sum?: TripSumOrderByAggregateInput
  }

  export type TripScalarWhereWithAggregatesInput = {
    AND?: TripScalarWhereWithAggregatesInput | TripScalarWhereWithAggregatesInput[]
    OR?: TripScalarWhereWithAggregatesInput[]
    NOT?: TripScalarWhereWithAggregatesInput | TripScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"Trip"> | string
    riderId?: StringWithAggregatesFilter<"Trip"> | string
    driverId?: StringNullableWithAggregatesFilter<"Trip"> | string | null
    status?: StringWithAggregatesFilter<"Trip"> | string
    pickupLat?: FloatWithAggregatesFilter<"Trip"> | number
    pickupLng?: FloatWithAggregatesFilter<"Trip"> | number
    pickupAddress?: StringWithAggregatesFilter<"Trip"> | string
    dropoffLat?: FloatWithAggregatesFilter<"Trip"> | number
    dropoffLng?: FloatWithAggregatesFilter<"Trip"> | number
    dropoffAddress?: StringWithAggregatesFilter<"Trip"> | string
    estimatedFare?: FloatWithAggregatesFilter<"Trip"> | number
    actualFare?: FloatNullableWithAggregatesFilter<"Trip"> | number | null
    paymentMethod?: StringWithAggregatesFilter<"Trip"> | string
    paymentStatus?: StringWithAggregatesFilter<"Trip"> | string
    promoCode?: StringNullableWithAggregatesFilter<"Trip"> | string | null
    promoDiscount?: FloatWithAggregatesFilter<"Trip"> | number
    distance?: FloatNullableWithAggregatesFilter<"Trip"> | number | null
    duration?: IntNullableWithAggregatesFilter<"Trip"> | number | null
    requestedAt?: DateTimeWithAggregatesFilter<"Trip"> | Date | string
    matchedAt?: DateTimeNullableWithAggregatesFilter<"Trip"> | Date | string | null
    startedAt?: DateTimeNullableWithAggregatesFilter<"Trip"> | Date | string | null
    completedAt?: DateTimeNullableWithAggregatesFilter<"Trip"> | Date | string | null
    cancelledAt?: DateTimeNullableWithAggregatesFilter<"Trip"> | Date | string | null
    cancellationReason?: StringNullableWithAggregatesFilter<"Trip"> | string | null
    cancelledBy?: StringNullableWithAggregatesFilter<"Trip"> | string | null
    driverRating?: FloatNullableWithAggregatesFilter<"Trip"> | number | null
    riderRating?: FloatNullableWithAggregatesFilter<"Trip"> | number | null
    updatedAt?: DateTimeWithAggregatesFilter<"Trip"> | Date | string
  }

  export type SOSWhereInput = {
    AND?: SOSWhereInput | SOSWhereInput[]
    OR?: SOSWhereInput[]
    NOT?: SOSWhereInput | SOSWhereInput[]
    id?: StringFilter<"SOS"> | string
    tripId?: StringNullableFilter<"SOS"> | string | null
    userId?: StringFilter<"SOS"> | string
    userType?: StringFilter<"SOS"> | string
    lat?: FloatFilter<"SOS"> | number
    lng?: FloatFilter<"SOS"> | number
    reason?: StringNullableFilter<"SOS"> | string | null
    status?: StringFilter<"SOS"> | string
    resolution?: StringNullableFilter<"SOS"> | string | null
    resolvedBy?: StringNullableFilter<"SOS"> | string | null
    resolvedAt?: DateTimeNullableFilter<"SOS"> | Date | string | null
    createdAt?: DateTimeFilter<"SOS"> | Date | string
    updatedAt?: DateTimeFilter<"SOS"> | Date | string
  }

  export type SOSOrderByWithRelationInput = {
    id?: SortOrder
    tripId?: SortOrderInput | SortOrder
    userId?: SortOrder
    userType?: SortOrder
    lat?: SortOrder
    lng?: SortOrder
    reason?: SortOrderInput | SortOrder
    status?: SortOrder
    resolution?: SortOrderInput | SortOrder
    resolvedBy?: SortOrderInput | SortOrder
    resolvedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SOSWhereUniqueInput = Prisma.AtLeast<{
    id?: string
    AND?: SOSWhereInput | SOSWhereInput[]
    OR?: SOSWhereInput[]
    NOT?: SOSWhereInput | SOSWhereInput[]
    tripId?: StringNullableFilter<"SOS"> | string | null
    userId?: StringFilter<"SOS"> | string
    userType?: StringFilter<"SOS"> | string
    lat?: FloatFilter<"SOS"> | number
    lng?: FloatFilter<"SOS"> | number
    reason?: StringNullableFilter<"SOS"> | string | null
    status?: StringFilter<"SOS"> | string
    resolution?: StringNullableFilter<"SOS"> | string | null
    resolvedBy?: StringNullableFilter<"SOS"> | string | null
    resolvedAt?: DateTimeNullableFilter<"SOS"> | Date | string | null
    createdAt?: DateTimeFilter<"SOS"> | Date | string
    updatedAt?: DateTimeFilter<"SOS"> | Date | string
  }, "id">

  export type SOSOrderByWithAggregationInput = {
    id?: SortOrder
    tripId?: SortOrderInput | SortOrder
    userId?: SortOrder
    userType?: SortOrder
    lat?: SortOrder
    lng?: SortOrder
    reason?: SortOrderInput | SortOrder
    status?: SortOrder
    resolution?: SortOrderInput | SortOrder
    resolvedBy?: SortOrderInput | SortOrder
    resolvedAt?: SortOrderInput | SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
    _count?: SOSCountOrderByAggregateInput
    _avg?: SOSAvgOrderByAggregateInput
    _max?: SOSMaxOrderByAggregateInput
    _min?: SOSMinOrderByAggregateInput
    _sum?: SOSSumOrderByAggregateInput
  }

  export type SOSScalarWhereWithAggregatesInput = {
    AND?: SOSScalarWhereWithAggregatesInput | SOSScalarWhereWithAggregatesInput[]
    OR?: SOSScalarWhereWithAggregatesInput[]
    NOT?: SOSScalarWhereWithAggregatesInput | SOSScalarWhereWithAggregatesInput[]
    id?: StringWithAggregatesFilter<"SOS"> | string
    tripId?: StringNullableWithAggregatesFilter<"SOS"> | string | null
    userId?: StringWithAggregatesFilter<"SOS"> | string
    userType?: StringWithAggregatesFilter<"SOS"> | string
    lat?: FloatWithAggregatesFilter<"SOS"> | number
    lng?: FloatWithAggregatesFilter<"SOS"> | number
    reason?: StringNullableWithAggregatesFilter<"SOS"> | string | null
    status?: StringWithAggregatesFilter<"SOS"> | string
    resolution?: StringNullableWithAggregatesFilter<"SOS"> | string | null
    resolvedBy?: StringNullableWithAggregatesFilter<"SOS"> | string | null
    resolvedAt?: DateTimeNullableWithAggregatesFilter<"SOS"> | Date | string | null
    createdAt?: DateTimeWithAggregatesFilter<"SOS"> | Date | string
    updatedAt?: DateTimeWithAggregatesFilter<"SOS"> | Date | string
  }

  export type TripCreateInput = {
    id?: string
    riderId: string
    driverId?: string | null
    status?: string
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    estimatedFare: number
    actualFare?: number | null
    paymentMethod?: string
    paymentStatus?: string
    promoCode?: string | null
    promoDiscount?: number
    distance?: number | null
    duration?: number | null
    requestedAt?: Date | string
    matchedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancellationReason?: string | null
    cancelledBy?: string | null
    driverRating?: number | null
    riderRating?: number | null
    updatedAt?: Date | string
  }

  export type TripUncheckedCreateInput = {
    id?: string
    riderId: string
    driverId?: string | null
    status?: string
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    estimatedFare: number
    actualFare?: number | null
    paymentMethod?: string
    paymentStatus?: string
    promoCode?: string | null
    promoDiscount?: number
    distance?: number | null
    duration?: number | null
    requestedAt?: Date | string
    matchedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancellationReason?: string | null
    cancelledBy?: string | null
    driverRating?: number | null
    riderRating?: number | null
    updatedAt?: Date | string
  }

  export type TripUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    riderId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    pickupAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    estimatedFare?: FloatFieldUpdateOperationsInput | number
    actualFare?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: StringFieldUpdateOperationsInput | string
    paymentStatus?: StringFieldUpdateOperationsInput | string
    promoCode?: NullableStringFieldUpdateOperationsInput | string | null
    promoDiscount?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matchedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancellationReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    driverRating?: NullableFloatFieldUpdateOperationsInput | number | null
    riderRating?: NullableFloatFieldUpdateOperationsInput | number | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TripUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    riderId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    pickupAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    estimatedFare?: FloatFieldUpdateOperationsInput | number
    actualFare?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: StringFieldUpdateOperationsInput | string
    paymentStatus?: StringFieldUpdateOperationsInput | string
    promoCode?: NullableStringFieldUpdateOperationsInput | string | null
    promoDiscount?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matchedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancellationReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    driverRating?: NullableFloatFieldUpdateOperationsInput | number | null
    riderRating?: NullableFloatFieldUpdateOperationsInput | number | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TripCreateManyInput = {
    id?: string
    riderId: string
    driverId?: string | null
    status?: string
    pickupLat: number
    pickupLng: number
    pickupAddress: string
    dropoffLat: number
    dropoffLng: number
    dropoffAddress: string
    estimatedFare: number
    actualFare?: number | null
    paymentMethod?: string
    paymentStatus?: string
    promoCode?: string | null
    promoDiscount?: number
    distance?: number | null
    duration?: number | null
    requestedAt?: Date | string
    matchedAt?: Date | string | null
    startedAt?: Date | string | null
    completedAt?: Date | string | null
    cancelledAt?: Date | string | null
    cancellationReason?: string | null
    cancelledBy?: string | null
    driverRating?: number | null
    riderRating?: number | null
    updatedAt?: Date | string
  }

  export type TripUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    riderId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    pickupAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    estimatedFare?: FloatFieldUpdateOperationsInput | number
    actualFare?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: StringFieldUpdateOperationsInput | string
    paymentStatus?: StringFieldUpdateOperationsInput | string
    promoCode?: NullableStringFieldUpdateOperationsInput | string | null
    promoDiscount?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matchedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancellationReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    driverRating?: NullableFloatFieldUpdateOperationsInput | number | null
    riderRating?: NullableFloatFieldUpdateOperationsInput | number | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type TripUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    riderId?: StringFieldUpdateOperationsInput | string
    driverId?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    pickupLat?: FloatFieldUpdateOperationsInput | number
    pickupLng?: FloatFieldUpdateOperationsInput | number
    pickupAddress?: StringFieldUpdateOperationsInput | string
    dropoffLat?: FloatFieldUpdateOperationsInput | number
    dropoffLng?: FloatFieldUpdateOperationsInput | number
    dropoffAddress?: StringFieldUpdateOperationsInput | string
    estimatedFare?: FloatFieldUpdateOperationsInput | number
    actualFare?: NullableFloatFieldUpdateOperationsInput | number | null
    paymentMethod?: StringFieldUpdateOperationsInput | string
    paymentStatus?: StringFieldUpdateOperationsInput | string
    promoCode?: NullableStringFieldUpdateOperationsInput | string | null
    promoDiscount?: FloatFieldUpdateOperationsInput | number
    distance?: NullableFloatFieldUpdateOperationsInput | number | null
    duration?: NullableIntFieldUpdateOperationsInput | number | null
    requestedAt?: DateTimeFieldUpdateOperationsInput | Date | string
    matchedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    startedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    completedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancelledAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    cancellationReason?: NullableStringFieldUpdateOperationsInput | string | null
    cancelledBy?: NullableStringFieldUpdateOperationsInput | string | null
    driverRating?: NullableFloatFieldUpdateOperationsInput | number | null
    riderRating?: NullableFloatFieldUpdateOperationsInput | number | null
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SOSCreateInput = {
    id?: string
    tripId?: string | null
    userId: string
    userType: string
    lat: number
    lng: number
    reason?: string | null
    status?: string
    resolution?: string | null
    resolvedBy?: string | null
    resolvedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SOSUncheckedCreateInput = {
    id?: string
    tripId?: string | null
    userId: string
    userType: string
    lat: number
    lng: number
    reason?: string | null
    status?: string
    resolution?: string | null
    resolvedBy?: string | null
    resolvedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SOSUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tripId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
    userType?: StringFieldUpdateOperationsInput | string
    lat?: FloatFieldUpdateOperationsInput | number
    lng?: FloatFieldUpdateOperationsInput | number
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    resolution?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedBy?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SOSUncheckedUpdateInput = {
    id?: StringFieldUpdateOperationsInput | string
    tripId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
    userType?: StringFieldUpdateOperationsInput | string
    lat?: FloatFieldUpdateOperationsInput | number
    lng?: FloatFieldUpdateOperationsInput | number
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    resolution?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedBy?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SOSCreateManyInput = {
    id?: string
    tripId?: string | null
    userId: string
    userType: string
    lat: number
    lng: number
    reason?: string | null
    status?: string
    resolution?: string | null
    resolvedBy?: string | null
    resolvedAt?: Date | string | null
    createdAt?: Date | string
    updatedAt?: Date | string
  }

  export type SOSUpdateManyMutationInput = {
    id?: StringFieldUpdateOperationsInput | string
    tripId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
    userType?: StringFieldUpdateOperationsInput | string
    lat?: FloatFieldUpdateOperationsInput | number
    lng?: FloatFieldUpdateOperationsInput | number
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    resolution?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedBy?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type SOSUncheckedUpdateManyInput = {
    id?: StringFieldUpdateOperationsInput | string
    tripId?: NullableStringFieldUpdateOperationsInput | string | null
    userId?: StringFieldUpdateOperationsInput | string
    userType?: StringFieldUpdateOperationsInput | string
    lat?: FloatFieldUpdateOperationsInput | number
    lng?: FloatFieldUpdateOperationsInput | number
    reason?: NullableStringFieldUpdateOperationsInput | string | null
    status?: StringFieldUpdateOperationsInput | string
    resolution?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedBy?: NullableStringFieldUpdateOperationsInput | string | null
    resolvedAt?: NullableDateTimeFieldUpdateOperationsInput | Date | string | null
    createdAt?: DateTimeFieldUpdateOperationsInput | Date | string
    updatedAt?: DateTimeFieldUpdateOperationsInput | Date | string
  }

  export type StringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type StringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type FloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type FloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type IntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type DateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type DateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type SortOrderInput = {
    sort: SortOrder
    nulls?: NullsOrder
  }

  export type TripCountOrderByAggregateInput = {
    id?: SortOrder
    riderId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    pickupAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    dropoffAddress?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrder
    paymentMethod?: SortOrder
    paymentStatus?: SortOrder
    promoCode?: SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    requestedAt?: SortOrder
    matchedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancellationReason?: SortOrder
    cancelledBy?: SortOrder
    driverRating?: SortOrder
    riderRating?: SortOrder
    updatedAt?: SortOrder
  }

  export type TripAvgOrderByAggregateInput = {
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    driverRating?: SortOrder
    riderRating?: SortOrder
  }

  export type TripMaxOrderByAggregateInput = {
    id?: SortOrder
    riderId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    pickupAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    dropoffAddress?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrder
    paymentMethod?: SortOrder
    paymentStatus?: SortOrder
    promoCode?: SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    requestedAt?: SortOrder
    matchedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancellationReason?: SortOrder
    cancelledBy?: SortOrder
    driverRating?: SortOrder
    riderRating?: SortOrder
    updatedAt?: SortOrder
  }

  export type TripMinOrderByAggregateInput = {
    id?: SortOrder
    riderId?: SortOrder
    driverId?: SortOrder
    status?: SortOrder
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    pickupAddress?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    dropoffAddress?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrder
    paymentMethod?: SortOrder
    paymentStatus?: SortOrder
    promoCode?: SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    requestedAt?: SortOrder
    matchedAt?: SortOrder
    startedAt?: SortOrder
    completedAt?: SortOrder
    cancelledAt?: SortOrder
    cancellationReason?: SortOrder
    cancelledBy?: SortOrder
    driverRating?: SortOrder
    riderRating?: SortOrder
    updatedAt?: SortOrder
  }

  export type TripSumOrderByAggregateInput = {
    pickupLat?: SortOrder
    pickupLng?: SortOrder
    dropoffLat?: SortOrder
    dropoffLng?: SortOrder
    estimatedFare?: SortOrder
    actualFare?: SortOrder
    promoDiscount?: SortOrder
    distance?: SortOrder
    duration?: SortOrder
    driverRating?: SortOrder
    riderRating?: SortOrder
  }

  export type StringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type StringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    mode?: QueryMode
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type FloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type FloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type IntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type DateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type DateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }

  export type SOSCountOrderByAggregateInput = {
    id?: SortOrder
    tripId?: SortOrder
    userId?: SortOrder
    userType?: SortOrder
    lat?: SortOrder
    lng?: SortOrder
    reason?: SortOrder
    status?: SortOrder
    resolution?: SortOrder
    resolvedBy?: SortOrder
    resolvedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SOSAvgOrderByAggregateInput = {
    lat?: SortOrder
    lng?: SortOrder
  }

  export type SOSMaxOrderByAggregateInput = {
    id?: SortOrder
    tripId?: SortOrder
    userId?: SortOrder
    userType?: SortOrder
    lat?: SortOrder
    lng?: SortOrder
    reason?: SortOrder
    status?: SortOrder
    resolution?: SortOrder
    resolvedBy?: SortOrder
    resolvedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SOSMinOrderByAggregateInput = {
    id?: SortOrder
    tripId?: SortOrder
    userId?: SortOrder
    userType?: SortOrder
    lat?: SortOrder
    lng?: SortOrder
    reason?: SortOrder
    status?: SortOrder
    resolution?: SortOrder
    resolvedBy?: SortOrder
    resolvedAt?: SortOrder
    createdAt?: SortOrder
    updatedAt?: SortOrder
  }

  export type SOSSumOrderByAggregateInput = {
    lat?: SortOrder
    lng?: SortOrder
  }

  export type StringFieldUpdateOperationsInput = {
    set?: string
  }

  export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null
  }

  export type FloatFieldUpdateOperationsInput = {
    set?: number
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableFloatFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type NullableIntFieldUpdateOperationsInput = {
    set?: number | null
    increment?: number
    decrement?: number
    multiply?: number
    divide?: number
  }

  export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string
  }

  export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null
  }

  export type NestedStringFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringFilter<$PrismaModel> | string
  }

  export type NestedStringNullableFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableFilter<$PrismaModel> | string | null
  }

  export type NestedFloatFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatFilter<$PrismaModel> | number
  }

  export type NestedFloatNullableFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableFilter<$PrismaModel> | number | null
  }

  export type NestedIntNullableFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableFilter<$PrismaModel> | number | null
  }

  export type NestedDateTimeFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeFilter<$PrismaModel> | Date | string
  }

  export type NestedDateTimeNullableFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableFilter<$PrismaModel> | Date | string | null
  }

  export type NestedStringWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel>
    in?: string[] | ListStringFieldRefInput<$PrismaModel>
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel>
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringWithAggregatesFilter<$PrismaModel> | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedStringFilter<$PrismaModel>
    _max?: NestedStringFilter<$PrismaModel>
  }

  export type NestedIntFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel>
    in?: number[] | ListIntFieldRefInput<$PrismaModel>
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel>
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntFilter<$PrismaModel> | number
  }

  export type NestedStringNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: string | StringFieldRefInput<$PrismaModel> | null
    in?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    notIn?: string[] | ListStringFieldRefInput<$PrismaModel> | null
    lt?: string | StringFieldRefInput<$PrismaModel>
    lte?: string | StringFieldRefInput<$PrismaModel>
    gt?: string | StringFieldRefInput<$PrismaModel>
    gte?: string | StringFieldRefInput<$PrismaModel>
    contains?: string | StringFieldRefInput<$PrismaModel>
    startsWith?: string | StringFieldRefInput<$PrismaModel>
    endsWith?: string | StringFieldRefInput<$PrismaModel>
    not?: NestedStringNullableWithAggregatesFilter<$PrismaModel> | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedStringNullableFilter<$PrismaModel>
    _max?: NestedStringNullableFilter<$PrismaModel>
  }

  export type NestedFloatWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel>
    in?: number[] | ListFloatFieldRefInput<$PrismaModel>
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel>
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatWithAggregatesFilter<$PrismaModel> | number
    _count?: NestedIntFilter<$PrismaModel>
    _avg?: NestedFloatFilter<$PrismaModel>
    _sum?: NestedFloatFilter<$PrismaModel>
    _min?: NestedFloatFilter<$PrismaModel>
    _max?: NestedFloatFilter<$PrismaModel>
  }

  export type NestedFloatNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | FloatFieldRefInput<$PrismaModel> | null
    in?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListFloatFieldRefInput<$PrismaModel> | null
    lt?: number | FloatFieldRefInput<$PrismaModel>
    lte?: number | FloatFieldRefInput<$PrismaModel>
    gt?: number | FloatFieldRefInput<$PrismaModel>
    gte?: number | FloatFieldRefInput<$PrismaModel>
    not?: NestedFloatNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedFloatNullableFilter<$PrismaModel>
    _min?: NestedFloatNullableFilter<$PrismaModel>
    _max?: NestedFloatNullableFilter<$PrismaModel>
  }

  export type NestedIntNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: number | IntFieldRefInput<$PrismaModel> | null
    in?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    notIn?: number[] | ListIntFieldRefInput<$PrismaModel> | null
    lt?: number | IntFieldRefInput<$PrismaModel>
    lte?: number | IntFieldRefInput<$PrismaModel>
    gt?: number | IntFieldRefInput<$PrismaModel>
    gte?: number | IntFieldRefInput<$PrismaModel>
    not?: NestedIntNullableWithAggregatesFilter<$PrismaModel> | number | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _avg?: NestedFloatNullableFilter<$PrismaModel>
    _sum?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedIntNullableFilter<$PrismaModel>
    _max?: NestedIntNullableFilter<$PrismaModel>
  }

  export type NestedDateTimeWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel>
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeWithAggregatesFilter<$PrismaModel> | Date | string
    _count?: NestedIntFilter<$PrismaModel>
    _min?: NestedDateTimeFilter<$PrismaModel>
    _max?: NestedDateTimeFilter<$PrismaModel>
  }

  export type NestedDateTimeNullableWithAggregatesFilter<$PrismaModel = never> = {
    equals?: Date | string | DateTimeFieldRefInput<$PrismaModel> | null
    in?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    notIn?: Date[] | string[] | ListDateTimeFieldRefInput<$PrismaModel> | null
    lt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    lte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gt?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    gte?: Date | string | DateTimeFieldRefInput<$PrismaModel>
    not?: NestedDateTimeNullableWithAggregatesFilter<$PrismaModel> | Date | string | null
    _count?: NestedIntNullableFilter<$PrismaModel>
    _min?: NestedDateTimeNullableFilter<$PrismaModel>
    _max?: NestedDateTimeNullableFilter<$PrismaModel>
  }



  /**
   * Batch Payload for updateMany & deleteMany & createMany
   */

  export type BatchPayload = {
    count: number
  }

  /**
   * DMMF
   */
  export const dmmf: runtime.BaseDMMF
}