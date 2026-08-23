/**
 * QNT-0012 · In-memory repositories.
 *
 * ⚠️ TEST-ONLY. These implementations exist exclusively for unit tests and
 * must never be used as demo data or wired into the public site. Real
 * persistence will come in a later phase once a database connection is
 * actually configured.
 */
import type { Customer } from './customer';
import type { Entitlement } from './entitlement';
import type { License } from './license';
import type { Order } from './order';
import type { Payment } from './payment';
import type { Plan } from './plan';
import type { Product } from './product';
import type {
  CustomerRepository,
  EntitlementRepository,
  LicenseRepository,
  OrderRepository,
  PaymentRepository,
  PlanRepository,
  ProductRepository,
} from './repositories';

export class MemoryProductRepository implements ProductRepository {
  constructor(private readonly products: Map<string, Product>) {}
  findById(productId: string): Product | undefined {
    return this.products.get(productId);
  }
  list(): Product[] {
    return [...this.products.values()];
  }
}

export class MemoryPlanRepository implements PlanRepository {
  constructor(private readonly plans: Plan[]) {}
  findByProductId(productId: string): Plan[] {
    return this.plans.filter((plan) => plan.productId === productId);
  }
}

export class MemoryCustomerRepository implements CustomerRepository {
  constructor(private readonly customers: Map<string, Customer>) {}
  findById(customerId: string): Customer | undefined {
    return this.customers.get(customerId);
  }
}

export class MemoryOrderRepository implements OrderRepository {
  constructor(private readonly orders: Map<string, Order>) {}
  findById(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }
}

export class MemoryPaymentRepository implements PaymentRepository {
  constructor(private readonly payments: Map<string, Payment>) {}
  findById(paymentId: string): Payment | undefined {
    return this.payments.get(paymentId);
  }
}

export class MemoryLicenseRepository implements LicenseRepository {
  constructor(private readonly licenses: License[]) {}
  findByCustomerAndProduct(customerId: string, productId: string): License[] {
    return this.licenses.filter(
      (license) => license.customerId === customerId && license.productId === productId,
    );
  }
}

export class MemoryEntitlementRepository implements EntitlementRepository {
  constructor(private readonly entitlements: Entitlement[]) {}
  findByCustomerAndProduct(customerId: string, productId: string): Entitlement[] {
    return this.entitlements.filter(
      (entitlement) => entitlement.customerId === customerId && entitlement.productId === productId,
    );
  }
}
