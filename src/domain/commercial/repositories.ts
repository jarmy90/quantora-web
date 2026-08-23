/**
 * QNT-0012 · Repository interfaces.
 *
 * Decoupled contracts for future persistence. No real remote implementation
 * exists in this phase (no demonstrated database connection); only a clearly
 * marked TEST-ONLY in-memory implementation ships in
 * `./memory-repositories.ts`. These interfaces exist so QNT-0013+ never
 * build storage logic directly into React components.
 */
import type { Customer } from './customer';
import type { Entitlement } from './entitlement';
import type { License } from './license';
import type { Order } from './order';
import type { Payment } from './payment';
import type { Plan } from './plan';
import type { Product } from './product';

export interface ProductRepository {
  /** Look up a product by its stable commercial productId (never the internal uuid). */
  findByProductId(productId: string): Product | undefined;
  list(): Product[];
}

export interface PlanRepository {
  findByProductId(productId: string): Plan[];
}

export interface CustomerRepository {
  findById(customerId: string): Customer | undefined;
}

export interface OrderRepository {
  findById(orderId: string): Order | undefined;
}

export interface PaymentRepository {
  findById(paymentId: string): Payment | undefined;
}

export interface LicenseRepository {
  findByCustomerAndProduct(customerId: string, productId: string): License[];
}

export interface EntitlementRepository {
  findByCustomerAndProduct(customerId: string, productId: string): Entitlement[];
}
