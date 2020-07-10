import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exist.');
    }

    const productsId = products.map(product => {
      const id = {
        id: product.id,
      };
      return id;
    });

    const productsDB = await this.productsRepository.findAllById(productsId);

    const newProducts = products.map(product => {
      const existProduct = productsDB.find(
        productDB => productDB.id === product.id,
      );

      if (!existProduct) {
        throw new AppError('Product does not exist', 400);
      }

      if (product.quantity > existProduct?.quantity) {
        throw new AppError(
          `Product quantity is higher than the available. ${existProduct?.name}`,
        );
      }

      return {
        ...product,
        price: existProduct.price,
      };
    });

    const productsFormatted = newProducts.map(product => {
      return {
        product_id: product.id,
        price: product.price,
        quantity: product.quantity,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsFormatted,
    });

    const updateProductsQuantity = productsDB.map(productDB => {
      const findIndex = products.findIndex(
        findIndexProduct => findIndexProduct.id === productDB.id,
      );

      const productQuantity = {
        id: productDB.id,
        quantity: productDB.quantity - products[findIndex].quantity,
      };

      return productQuantity;
    });

    await this.productsRepository.updateQuantity(updateProductsQuantity);

    return order;
  }
}

export default CreateOrderService;
