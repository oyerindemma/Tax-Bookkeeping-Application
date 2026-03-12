import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EXPENSE_CATEGORIES = [
  "Office",
  "Software",
  "Utilities",
  "Marketing",
  "Transport",
  "Rent",
  "Miscellaneous",
];

const DEMO_EMAIL = process.env.DEMO_EMAIL || "demo@taxbook.app";
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || "DemoPass123!";
const DEMO_NAME = process.env.DEMO_NAME || "TaxBook Demo";

async function findOrCreateWorkspace(userId) {
  const membership = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      workspace: {
        name: "TaxBook Demo Workspace",
      },
    },
    include: { workspace: true },
  });

  if (membership?.workspace) {
    await prisma.workspace.update({
      where: { id: membership.workspace.id },
      data: { archivedAt: null, name: "TaxBook Demo Workspace" },
    });
    return membership.workspace;
  }

  return prisma.workspace.create({
    data: {
      name: "TaxBook Demo Workspace",
      members: {
        create: {
          userId,
          role: "OWNER",
        },
      },
    },
  });
}

async function ensureDefaultCategories(workspaceId) {
  const existing = await prisma.expenseCategory.findMany({
    where: { workspaceId },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((item) => item.name.trim().toLowerCase()));
  const missing = DEFAULT_EXPENSE_CATEGORIES.filter(
    (name) => !existingNames.has(name.toLowerCase())
  );

  if (missing.length === 0) return;

  await prisma.expenseCategory.createMany({
    data: missing.map((name) => ({ workspaceId, name })),
  });
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL.toLowerCase() },
    update: {
      fullName: DEMO_NAME,
      password: passwordHash,
    },
    create: {
      email: DEMO_EMAIL.toLowerCase(),
      fullName: DEMO_NAME,
      password: passwordHash,
      role: "USER",
    },
  });

  const workspace = await findOrCreateWorkspace(user.id);

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: { role: "OWNER" },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    },
  });

  await prisma.workspaceSubscription.upsert({
    where: { workspaceId: workspace.id },
    update: {
      plan: "BUSINESS",
      status: "active",
    },
    create: {
      workspaceId: workspace.id,
      plan: "BUSINESS",
      status: "active",
    },
  });

  await ensureDefaultCategories(workspace.id);

  const existingClient = await prisma.client.findFirst({
    where: {
      workspaceId: workspace.id,
      email: "finance@acme-demo.test",
    },
  });

  const client = existingClient
    ? await prisma.client.update({
        where: { id: existingClient.id },
        data: {
          name: "Acme Industries",
          companyName: "Acme Industries Ltd",
          email: "finance@acme-demo.test",
          phone: "+2348000009001",
          address: "Marina, Lagos",
          taxId: "TIN-DEMO-001",
          notes: "Demo client for beta walkthroughs.",
        },
      })
    : await prisma.client.create({
        data: {
          workspaceId: workspace.id,
          name: "Acme Industries",
          companyName: "Acme Industries Ltd",
          email: "finance@acme-demo.test",
          phone: "+2348000009001",
          address: "Marina, Lagos",
          taxId: "TIN-DEMO-001",
          notes: "Demo client for beta walkthroughs.",
        },
      });

  const softwareCategory = await prisma.expenseCategory.findFirst({
    where: { workspaceId: workspace.id, name: "Software" },
  });

  const invoice = await prisma.invoice.upsert({
    where: {
      workspaceId_invoiceNumber: {
        workspaceId: workspace.id,
        invoiceNumber: "TB-9001",
      },
    },
    update: {
      clientId: client.id,
      status: "PAID",
      issueDate: new Date("2026-03-01T00:00:00.000Z"),
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
      subtotal: 120000,
      taxAmount: 9000,
      totalAmount: 129000,
      paymentReference: "DEMO-PAY-9001",
      paymentUrl: "http://localhost:3000/pay/DEMO-PAY-9001",
      paidAt: new Date("2026-03-10T09:00:00.000Z"),
      notes: "Demo invoice",
    },
    create: {
      workspaceId: workspace.id,
      clientId: client.id,
      invoiceNumber: "TB-9001",
      status: "PAID",
      issueDate: new Date("2026-03-01T00:00:00.000Z"),
      dueDate: new Date("2026-03-10T00:00:00.000Z"),
      subtotal: 120000,
      taxAmount: 9000,
      totalAmount: 129000,
      paymentReference: "DEMO-PAY-9001",
      paymentUrl: "http://localhost:3000/pay/DEMO-PAY-9001",
      paidAt: new Date("2026-03-10T09:00:00.000Z"),
      notes: "Demo invoice",
    },
  });

  await prisma.invoiceItem.deleteMany({ where: { invoiceId: invoice.id } });
  await prisma.invoiceItem.createMany({
    data: [
      {
        invoiceId: invoice.id,
        description: "Monthly bookkeeping retainer",
        quantity: 1,
        unitPrice: 100000,
        taxRate: 7.5,
        lineTotal: 107500,
      },
      {
        invoiceId: invoice.id,
        description: "VAT filing support",
        quantity: 1,
        unitPrice: 20000,
        taxRate: 7.5,
        lineTotal: 21500,
      },
    ],
  });

  await prisma.taxRecord.upsert({
    where: { invoiceId: invoice.id },
    update: {
      userId: user.id,
      workspaceId: workspace.id,
      kind: "INCOME",
      amountKobo: 129000,
      taxRate: 6.98,
      computedTax: 9000,
      netAmount: 120000,
      currency: "NGN",
      occurredOn: new Date("2026-03-10T09:00:00.000Z"),
      description: "Invoice #TB-9001",
      source: "invoice",
    },
    create: {
      userId: user.id,
      workspaceId: workspace.id,
      invoiceId: invoice.id,
      kind: "INCOME",
      amountKobo: 129000,
      taxRate: 6.98,
      computedTax: 9000,
      netAmount: 120000,
      currency: "NGN",
      occurredOn: new Date("2026-03-10T09:00:00.000Z"),
      description: "Invoice #TB-9001",
      source: "invoice",
    },
  });

  const demoExpense = await prisma.taxRecord.findFirst({
    where: {
      workspaceId: workspace.id,
      description: "Adobe Creative Cloud",
      kind: "EXPENSE",
    },
  });

  if (demoExpense) {
    await prisma.taxRecord.update({
      where: { id: demoExpense.id },
      data: {
        userId: user.id,
        categoryId: softwareCategory?.id ?? null,
        amountKobo: 500000,
        taxRate: 7.5,
        computedTax: 37500,
        netAmount: 462500,
        currency: "NGN",
        occurredOn: new Date("2026-03-09T00:00:00.000Z"),
        vendorName: "Adobe",
        recurring: true,
      },
    });
  } else {
    await prisma.taxRecord.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        categoryId: softwareCategory?.id ?? null,
        kind: "EXPENSE",
        amountKobo: 500000,
        taxRate: 7.5,
        computedTax: 37500,
        netAmount: 462500,
        currency: "NGN",
        occurredOn: new Date("2026-03-09T00:00:00.000Z"),
        description: "Adobe Creative Cloud",
        vendorName: "Adobe",
        recurring: true,
      },
    });
  }

  const demoWht = await prisma.taxRecord.findFirst({
    where: {
      workspaceId: workspace.id,
      description: "Demo WHT deduction",
      kind: "WHT",
    },
  });

  if (demoWht) {
    await prisma.taxRecord.update({
      where: { id: demoWht.id },
      data: {
        userId: user.id,
        amountKobo: 150000,
        taxRate: 10,
        computedTax: 15000,
        netAmount: 135000,
        currency: "NGN",
        occurredOn: new Date("2026-03-12T00:00:00.000Z"),
      },
    });
  } else {
    await prisma.taxRecord.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        kind: "WHT",
        amountKobo: 150000,
        taxRate: 10,
        computedTax: 15000,
        netAmount: 135000,
        currency: "NGN",
        occurredOn: new Date("2026-03-12T00:00:00.000Z"),
        description: "Demo WHT deduction",
      },
    });
  }

  const existingBankAccount = await prisma.bankAccount.findFirst({
    where: {
      workspaceId: workspace.id,
      accountNumber: "0001234567",
    },
  });

  const bankAccount = existingBankAccount
    ? await prisma.bankAccount.update({
        where: { id: existingBankAccount.id },
        data: {
          name: "Demo Operating Account",
          bankName: "TaxBook Bank",
          currency: "NGN",
        },
      })
    : await prisma.bankAccount.create({
        data: {
          workspaceId: workspace.id,
          name: "Demo Operating Account",
          bankName: "TaxBook Bank",
          accountNumber: "0001234567",
          currency: "NGN",
        },
      });

  const existingBankTransaction = await prisma.bankTransaction.findFirst({
    where: {
      workspaceId: workspace.id,
      reference: "DEMO-EXP-9001",
    },
  });

  if (existingBankTransaction) {
    await prisma.bankTransaction.update({
      where: { id: existingBankTransaction.id },
      data: {
        bankAccountId: bankAccount.id,
        transactionDate: new Date("2026-03-09T00:00:00.000Z"),
        description: "Adobe debit",
        amount: 500000,
        type: "DEBIT",
        status: "UNMATCHED",
      },
    });
  } else {
    await prisma.bankTransaction.create({
      data: {
        workspaceId: workspace.id,
        bankAccountId: bankAccount.id,
        transactionDate: new Date("2026-03-09T00:00:00.000Z"),
        description: "Adobe debit",
        reference: "DEMO-EXP-9001",
        amount: 500000,
        type: "DEBIT",
        status: "UNMATCHED",
      },
    });
  }

  console.log("Demo seed ready");
  console.log(`Email: ${DEMO_EMAIL.toLowerCase()}`);
  console.log(`Password: ${DEMO_PASSWORD}`);
  console.log(`Workspace: ${workspace.name}`);
}

main()
  .catch((error) => {
    console.error("Demo seed failed", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
