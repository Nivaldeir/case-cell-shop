import type { OpenAPIV3 } from "openapi-types";

const errorSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		message: { type: "string" },
		error: { type: "boolean", example: true },
		statusCode: { type: "integer" },
	},
};

const paginationSchema: OpenAPIV3.SchemaObject = {
	type: "object",
	properties: {
		page: { type: "integer", example: 1 },
		limit: { type: "integer", example: 10 },
		totalItems: { type: "integer", example: 42 },
		totalPages: { type: "integer", example: 5 },
		hasNextPage: { type: "boolean" },
		hasPreviousPage: { type: "boolean" },
	},
};

export const swaggerSpec: OpenAPIV3.Document = {
	openapi: "3.0.3",
	info: {
		title: "Payments API",
		description:
			"API de processamento de pedidos e pagamentos com padrão Saga distribuída.\n\n" +
			"O fluxo de criação de pedido é **assíncrono**: `POST /checkout` retorna `202` imediatamente " +
			"com `orderId` e o processamento (reserva de estoque + pagamento) ocorre em background via workers SQS.\n\n" +
			"Acompanhe o resultado final via `GET /checkout/{orderId}/status`.",
		version: "1.0.0",
		contact: {
			name: "CaseCellShop",
		},
	},
	servers: [
		{
			url: "/api/v1",
			description: "Servidor local",
		},
	],
	tags: [
		{
			name: "Produtos",
			description: "Gerenciamento do catálogo de produtos",
		},
		{
			name: "Pedidos",
			description: "Criação e acompanhamento de pedidos (fluxo Saga)",
		},
	],
	components: {
		schemas: {
			Error: errorSchema,
			Pagination: paginationSchema,
			OrderStatus: {
				type: "string",
				enum: ["pending", "paid", "shipped", "delivered", "cancelled"],
				description:
					"`pending` → aguardando processamento\n`paid` → pagamento aprovado\n`shipped` → enviado\n`delivered` → entregue\n`cancelled` → cancelado (estoque insuficiente ou pagamento recusado)",
			},
			PaymentStatus: {
				type: "string",
				enum: ["pending", "paid", "failed", "refunded"],
			},
			PaymentType: {
				type: "string",
				enum: ["credit_card", "pix", "boleto"],
			},
			SagaStatus: {
				type: "string",
				enum: ["pending", "running", "completed", "failed", "compensated"],
				description:
					"`pending` → saga criada, aguardando worker-stock\n" +
					"`running` → worker processando o step atual\n" +
					"`completed` → pagamento aprovado\n" +
					"`failed` → erro técnico (retries esgotados)\n" +
					"`compensated` → pagamento recusado, compensação executada",
			},
			Product: {
				type: "object",
				properties: {
					id: { type: "string", example: "prd_abc123" },
					name: { type: "string", example: "Capinha iPhone 15 Pro" },
					description: {
						type: "string",
						example: "Capinha protetora de silicone",
					},
					price: { type: "number", format: "float", example: 49.9 },
					stock: { type: "integer", example: 100 },
					version: {
						type: "integer",
						example: 1,
						description: "Versão para optimistic locking",
					},
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			OrderItem: {
				type: "object",
				properties: {
					id: { type: "string", example: "item_xyz789" },
					productId: { type: "string", example: "prd_abc123" },
					price: { type: "number", format: "float", example: 49.9 },
					quantity: { type: "integer", example: 2 },
				},
			},
			Order: {
				type: "object",
				properties: {
					id: { type: "string", example: "ord_def456" },
					idempotencyKey: { type: "string", example: "meu-pedido-unico-001" },
					status: { $ref: "#/components/schemas/OrderStatus" },
					amount: {
						type: "number",
						format: "float",
						example: 99.8,
						description: "Total calculado (soma de price × quantity)",
					},
					ordemItems: {
						type: "array",
						items: { $ref: "#/components/schemas/OrderItem" },
					},
					createdAt: { type: "string", format: "date-time" },
					updatedAt: { type: "string", format: "date-time" },
				},
			},
			Payment: {
				type: "object",
				properties: {
					paymentId: { type: "string", example: "pay_ghi012" },
					status: { $ref: "#/components/schemas/PaymentStatus" },
					type: { $ref: "#/components/schemas/PaymentType" },
					amount: { type: "number", format: "float", example: 99.8 },
				},
				nullable: true,
			},
			RequestContext: {
				type: "object",
				properties: {
					requestId: { type: "string", format: "uuid" },
					correlationId: { type: "string" },
				},
			},
		},
		headers: {
			"x-request-id": {
				schema: { type: "string" },
				description:
					"Span ID do OpenTelemetry — use para localizar o span exato no Jaeger (`/api-docs` → copie o valor e busque em **Jaeger UI → Search → Span ID**).",
			},
			"x-correlation-id": {
				schema: { type: "string" },
				description:
					"Trace ID do OpenTelemetry — identifica o trace completo no Jaeger (todos os spans da requisição, incluindo workers).",
			},
		},
	},
	paths: {
		"/product": {
			post: {
				tags: ["Produtos"],
				summary: "Criar produto",
				operationId: "createProduct",
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["name", "price", "stock"],
								properties: {
									name: {
										type: "string",
										minLength: 5,
										example: "Capinha iPhone 15 Pro",
									},
									price: {
										type: "number",
										minimum: 0,
										exclusiveMinimum: true,
										example: 49.9,
									},
									stock: { type: "integer", minimum: 0, example: 100 },
									description: {
										type: "string",
										example: "Capinha protetora de silicone premium",
									},
								},
							},
						},
					},
				},
				responses: {
					"201": {
						description: "Produto criado com sucesso",
						headers: {
							"x-request-id": { $ref: "#/components/headers/x-request-id" },
							"x-correlation-id": {
								$ref: "#/components/headers/x-correlation-id",
							},
						},
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: {
											type: "string",
											example: "Product created with successfully",
										},
										error: { type: "boolean", example: false },
										data: {
											type: "object",
											properties: {
												productId: { type: "string", example: "prd_abc123" },
											},
										},
									},
								},
							},
						},
					},
					"400": {
						description: "Dados inválidos (validação Zod)",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: {
									message: "name must have at least 5 characters",
									error: true,
									statusCode: 400,
								},
							},
						},
					},
				},
			},
			get: {
				tags: ["Produtos"],
				summary: "Listar produtos",
				operationId: "listProducts",
				parameters: [
					{
						name: "page",
						in: "query",
						schema: { type: "integer", minimum: 1, default: 1 },
						description: "Número da página",
					},
					{
						name: "limit",
						in: "query",
						schema: { type: "integer", minimum: 1, maximum: 100, default: 10 },
						description: "Itens por página (máx. 100)",
					},
				],
				responses: {
					"202": {
						description: "Lista de produtos com paginação",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: {
											type: "string",
											example: "Product search successful",
										},
										error: { type: "boolean", example: false },
										data: {
											type: "array",
											items: { $ref: "#/components/schemas/Product" },
										},
										pagination: { $ref: "#/components/schemas/Pagination" },
									},
								},
							},
						},
					},
				},
			},
		},
		"/checkout": {
			post: {
				tags: ["Pedidos"],
				summary: "Criar pedido (inicia saga assíncrona)",
				operationId: "createOrder",
				description:
					"Cria um novo pedido e inicia o fluxo Saga em background.\n\n" +
					"Retorna `202` imediatamente — o pagamento **não** foi processado ainda.\n" +
					"Acompanhe via `GET /checkout/{orderId}/status`.\n\n" +
					"O header `Idempotency-Key` é **obrigatório** para evitar pedidos duplicados.",
				parameters: [
					{
						name: "Idempotency-Key",
						in: "header",
						required: true,
						schema: { type: "string" },
						description:
							"Chave única para garantir idempotência. Requisições com a mesma chave retornam o pedido original.",
						example: "meu-pedido-unico-001",
					},
				],
				requestBody: {
					required: true,
					content: {
						"application/json": {
							schema: {
								type: "object",
								required: ["items"],
								properties: {
									items: {
										type: "array",
										minItems: 1,
										items: {
											type: "object",
											required: ["productId", "quantity"],
											properties: {
												productId: { type: "string", example: "prd_abc123" },
												quantity: { type: "integer", minimum: 1, example: 2 },
											},
										},
									},
								},
							},
							example: {
								items: [{ productId: "prd_abc123", quantity: 2 }],
							},
						},
					},
				},
				responses: {
					"202": {
						description: "Pedido aceito, saga iniciada em background",
						headers: {
							"x-request-id": { $ref: "#/components/headers/x-request-id" },
							"x-correlation-id": {
								$ref: "#/components/headers/x-correlation-id",
							},
						},
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: {
											type: "string",
											example: "Order requested successfully",
										},
										error: { type: "boolean", example: false },
										request: { $ref: "#/components/schemas/RequestContext" },
										data: { $ref: "#/components/schemas/Order" },
									},
								},
							},
						},
					},
					"400": {
						description: "Dados inválidos ou header Idempotency-Key ausente",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								examples: {
									missingHeader: {
										summary: "Header Idempotency-Key ausente",
										value: {
											message: "Header Idempotency-Key é obrigatório",
											error: true,
											statusCode: 400,
										},
									},
									emptyItems: {
										summary: "Lista de itens vazia",
										value: {
											message: "items must have at least 1 item",
											error: true,
											statusCode: 400,
										},
									},
								},
							},
						},
					},
					"404": {
						description: "Produto não encontrado",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: {
									message: "Product not found",
									error: true,
									statusCode: 404,
								},
							},
						},
					},
					"409": {
						description: "Conflito de versão no estoque (optimistic locking)",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: {
									message: "Stock conflict, please retry",
									error: true,
									statusCode: 409,
								},
							},
						},
					},
				},
			},
		},
		"/checkout/{orderId}/status": {
			get: {
				tags: ["Pedidos"],
				summary: "Consultar status do pedido",
				operationId: "getOrderStatus",
				description:
					"Retorna o estado atual do pedido, incluindo o resultado do pagamento (quando disponível).\n\n" +
					"Como o processamento é assíncrono, o `status` pode ainda estar `pending` logo após criar o pedido.",
				parameters: [
					{
						name: "orderId",
						in: "path",
						required: true,
						schema: { type: "string" },
						description: "ID do pedido retornado no `POST /checkout`",
						example: "ord_def456",
					},
				],
				responses: {
					"202": {
						description: "Status do pedido",
						content: {
							"application/json": {
								schema: {
									type: "object",
									properties: {
										message: { type: "string", example: "successfully" },
										error: { type: "boolean", example: false },
										data: {
											type: "object",
											properties: {
												orderId: { type: "string", example: "ord_def456" },
												status: { $ref: "#/components/schemas/OrderStatus" },
												amount: {
													type: "number",
													format: "float",
													example: 99.8,
												},
												items: {
													type: "array",
													items: {
														type: "object",
														properties: {
															productId: {
																type: "string",
																example: "prd_abc123",
															},
															quantity: { type: "integer", example: 2 },
															price: {
																type: "number",
																format: "float",
																example: 49.9,
															},
														},
													},
												},
												payment: { $ref: "#/components/schemas/Payment" },
											},
										},
									},
								},
								examples: {
									paid: {
										summary: "Pedido aprovado",
										value: {
											message: "successfully",
											error: false,
											data: {
												orderId: "ord_def456",
												status: "paid",
												amount: 99.8,
												items: [
													{ productId: "prd_abc123", quantity: 2, price: 49.9 },
												],
												payment: {
													paymentId: "pay_ghi012",
													status: "paid",
													type: "pix",
													amount: 99.8,
												},
											},
										},
									},
									pending: {
										summary: "Pedido ainda em processamento",
										value: {
											message: "successfully",
											error: false,
											data: {
												orderId: "ord_def456",
												status: "pending",
												amount: 99.8,
												items: [
													{ productId: "prd_abc123", quantity: 2, price: 49.9 },
												],
												payment: null,
											},
										},
									},
									cancelled: {
										summary: "Pedido cancelado (pagamento recusado)",
										value: {
											message: "successfully",
											error: false,
											data: {
												orderId: "ord_def456",
												status: "cancelled",
												amount: 99.8,
												items: [
													{ productId: "prd_abc123", quantity: 2, price: 49.9 },
												],
												payment: {
													paymentId: "pay_ghi012",
													status: "failed",
													type: "pix",
													amount: 99.8,
												},
											},
										},
									},
								},
							},
						},
					},
					"400": {
						description: "orderId inválido",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
							},
						},
					},
					"404": {
						description: "Pedido não encontrado",
						content: {
							"application/json": {
								schema: { $ref: "#/components/schemas/Error" },
								example: {
									message: "Order not found",
									error: true,
									statusCode: 404,
								},
							},
						},
					},
				},
			},
		},
	},
};
