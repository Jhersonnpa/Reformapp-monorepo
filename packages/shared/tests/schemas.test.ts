import { chooseTechSchema, pushTokenSchema, ratingCreateSchema, requestCreateSchema, RequestCategory, signInSchema, signUpSchema, toDbRole, toUiRole, Role } from "../src/index";

describe("shared schemas", () => {
  test("signInSchema acepta credenciales válidas", () => {
    const r = signInSchema.safeParse({ email: "Test@Example.com ", password: "x" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("test@example.com");
  });

  test("signInSchema rechaza email inválido y password vacía", () => {
    expect(signInSchema.safeParse({ email: "no-es-email", password: "x" }).success).toBe(false);
    expect(signInSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });

  test("signUpSchema exige password fuerte", () => {
    const base = {
      email: "cliente@example.com",
      username: "cliente_1",
      firstName: "Ana",
      lastName: "García",
      phone: "+34600111222",
      province: "Madrid",
      locality: "Madrid",
      address: "Calle Mayor 1",
    };
    expect(signUpSchema.safeParse({ ...base, password: "abc" }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...base, password: "Aa1!aaaa" }).success).toBe(true);
  });

  test("signUpSchema no admite role del cliente", () => {
    const r = signUpSchema.safeParse({
      email: "a@b.com",
      password: "Aa1!aaaa",
      username: "abc",
      firstName: "A",
      lastName: "B",
      phone: "+34123456789",
      province: "P",
      locality: "L",
      address: "C",
      role: "ADMIN",
    });
    // zod strip por defecto: el campo extra se ignora, nunca se tipa
    expect(r.success).toBe(true);
    if (r.success) expect("role" in r.data).toBe(false);
  });

  test("mappers de rol", () => {
    expect(toUiRole(Role.CLIENT)).toBe("client");
    expect(toDbRole("admin")).toBe(Role.ADMIN);
  });

  test("requestCreateSchema acepta solicitud válida", () => {
    const r = requestCreateSchema.safeParse({
      category: RequestCategory.PLUMBING,
      description: "Se ha roto una tubería del baño y pierde agua.",
      province: "Madrid",
      locality: "Madrid",
      address: "Calle Mayor 1",
      availability: "Tardes",
    });
    expect(r.success).toBe(true);
  });

  test("requestCreateSchema rechaza categoría y descripción corta", () => {
    const base = {
      description: "Se ha roto una tubería del baño.",
      province: "Madrid",
      locality: "Madrid",
      address: "Calle Mayor 1",
    };
    expect(requestCreateSchema.safeParse({ ...base, category: "FONTANERIA" }).success).toBe(false);
    expect(requestCreateSchema.safeParse({ ...base, category: RequestCategory.OTHER, description: "corto" }).success).toBe(false);
  });

  test("ratingCreateSchema exige 1-5 y comentario opcional", () => {
    expect(ratingCreateSchema.safeParse({ score: 5 }).success).toBe(true);
    expect(ratingCreateSchema.safeParse({ score: 5, comment: "Buen trabajo" }).success).toBe(true);
    expect(ratingCreateSchema.safeParse({ score: 0 }).success).toBe(false);
    expect(ratingCreateSchema.safeParse({ score: 6 }).success).toBe(false);
    expect(ratingCreateSchema.safeParse({ score: 4.5 }).success).toBe(false);
  });

  test("chooseTechSchema exige id de técnico", () => {
    expect(chooseTechSchema.safeParse({ techId: "00000000-0000-4000-8000-000000000000" }).success).toBe(true);
    expect(chooseTechSchema.safeParse({ techId: "abc-123" }).success).toBe(true);
    expect(chooseTechSchema.safeParse({ techId: "" }).success).toBe(false);
    expect(chooseTechSchema.safeParse({}).success).toBe(false);
  });

  test("pushTokenSchema solo acepta tokens Expo", () => {
    expect(pushTokenSchema.safeParse({ token: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]" }).success).toBe(true);
    expect(pushTokenSchema.safeParse({ token: "no-es-un-token" }).success).toBe(false);
    expect(pushTokenSchema.safeParse({}).success).toBe(false);
  });
});
