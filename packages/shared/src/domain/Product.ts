import z from "zod";
import { BaseDomain } from "./BaseDomain";
import { GenerateId } from "./GenerateId";


export const productSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(5),
    stock: z.int(),
    version: z.int(),
    price: z.number().positive(),
    description: z.string().optional(),
    createdAt: z.date(),
	updatedAt: z.date(),
	deletedAt: z.date().nullable(),
})

export type ProductProps = z.infer<typeof productSchema>;

export class Product extends BaseDomain<ProductProps>{

    static create(
		props: Omit<ProductProps, "id" | "createdAt" | "updatedAt">,
	): Product {
		const now = new Date();

		return new Product({
            createdAt: now,
            deletedAt: null,
            updatedAt: now,
            name: props.name,
            price: props.price,
            stock: props.stock,
            version: 1,
            description: props.description,
            id: GenerateId.generate("prd")
		});
	}

	static restore(props: ProductProps): Product {
		return new Product(props);
	}

    desatived(){
		const now = new Date();
        this.set("deletedAt", now)
        this.set("updatedAt", now);
    }

    actived(){
        this.set("deletedAt", null);
        this.set("updatedAt", new Date());
    }

    incrementStock(qtd: number){
        if(qtd <= 0){
            throw new Error("Quantidade tem que acima 0")
        }
        this.set("stock", this.get("stock") + qtd)
        this.set("version", this.get("version") + 1)
        this.set("updatedAt", new Date())
    }

    decrementStock(qtd: number){
        if(qtd <= 0){
            throw new Error("Quantidade tem que acima 0")
        }
        if(qtd > this.get("stock")){
            throw new Error("Estoque insuficiente")
        }
        this.set("stock", this.get("stock") - qtd)
        this.set("version", this.get("version") + 1)
        this.set("updatedAt", new Date())
    }
}