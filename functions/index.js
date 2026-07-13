const { onRequest } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'lojatopmix';
const databaseUrl = process.env.FIREBASE_DATABASE_URL || `https://${projectId}-default-rtdb.firebaseio.com`;

admin.initializeApp({
  databaseURL: databaseUrl,
});

const database = admin.database();
const INFINITEPAY_API_BASE_URL = 'https://api.checkout.infinitepay.io';
const INFINITEPAY_HANDLE = 'roselinebragatto';

const buildPublicBaseUrl = () => {
  const fallbackBaseUrl = `https://${projectId}.web.app`;
  const baseUrl = process.env.APP_BASE_URL || fallbackBaseUrl;

  return baseUrl.replace(/\/+$/, '');
};

const buildRedirectUrl = () => {
  const redirectUrl = process.env.INFINITEPAY_REDIRECT_URL || `${buildPublicBaseUrl()}/checkout/retorno`;
  return redirectUrl.replace(/\/+$/, '');
};

const buildWebhookUrl = () => process.env.INFINITEPAY_WEBHOOK_URL || `${buildPublicBaseUrl()}/api/infinitePayWebhook`;

const sanitizeString = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim();
};

const createOrderNsu = () => `tmx-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const buildErrorMessage = async (response) => {
  const fallbackMessage = `InfinitePay respondeu com status ${response.status}.`;

  try {
    const data = await response.json();

    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message.trim();
    }

    return fallbackMessage;
  } catch (error) {
    logger.error('Falha ao interpretar erro da InfinitePay.', error);
    return fallbackMessage;
  }
};

const normalizeItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Informe ao menos um item para criar o checkout.');
  }

  return items.map((item, index) => {
    const quantity = Number(item?.quantity);
    const price = Number(item?.price);
    const description = sanitizeString(item?.description);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Item ${index + 1}: quantidade invalida.`);
    }

    if (!Number.isInteger(price) || price <= 0) {
      throw new Error(`Item ${index + 1}: preco invalido.`);
    }

    if (!description) {
      throw new Error(`Item ${index + 1}: descricao obrigatoria.`);
    }

    return {
      quantity,
      price,
      description,
      productId: sanitizeString(item?.productId) || undefined,
      variationKey: sanitizeString(item?.variationKey) || undefined,
      note: sanitizeString(item?.note) || undefined,
    };
  });
};

const normalizeCustomer = (customer) => {
  if (!customer || typeof customer !== 'object') {
    return null;
  }

  const name = sanitizeString(customer.name);

  if (!name) {
    return null;
  }

  const email = sanitizeString(customer.email);
  const phoneNumber = sanitizeString(customer.phone_number);

  return {
    name,
    email: email || undefined,
    phone_number: phoneNumber || undefined,
  };
};

const normalizeAddress = (address) => {
  if (!address || typeof address !== 'object') {
    return null;
  }

  const cep = sanitizeString(address.cep).replace(/\D/g, '');
  const number = sanitizeString(address.number);

  if (!cep || !number) {
    return null;
  }

  const complement = sanitizeString(address.complement);

  return {
    cep,
    number,
    complement: complement || undefined,
  };
};

const buildOrderRecord = ({ orderNsu, items, customer, address }) => ({
  orderNsu,
  handle: INFINITEPAY_HANDLE,
  status: 'creating_checkout',
  totalAmount: items.reduce((sum, item) => sum + item.quantity * item.price, 0),
  customer,
  address,
  items,
  createdAt: admin.database.ServerValue.TIMESTAMP,
  updatedAt: admin.database.ServerValue.TIMESTAMP,
});

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const sanitizeObjectString = (value) => {
  const parsed = sanitizeString(value);
  return parsed || undefined;
};

const buildSaleItemRecord = ({ rawItem, product, showcase, variation }) => {
  const quantity = toNumber(rawItem?.quantity);
  const unitPrice = toNumber(rawItem?.price) / 100;
  const description = sanitizeString(rawItem?.description) || sanitizeString(showcase?.name) || sanitizeString(product?.name) || 'Item';

  return {
    productId: sanitizeObjectString(rawItem?.productId) || null,
    variationKey: sanitizeObjectString(rawItem?.variationKey) || null,
    productName: sanitizeString(showcase?.name) || sanitizeString(product?.name) || description,
    description,
    note: sanitizeObjectString(rawItem?.note) || null,
    quantity,
    unitPrice,
    lineTotal: unitPrice * quantity,
    size: sanitizeObjectString(variation?.size) || null,
    color: sanitizeObjectString(variation?.color) || null,
  };
};

const hasAvailableVariationStock = (variations) => {
  if (!variations || typeof variations !== 'object') {
    return false;
  }

  return Object.values(variations).some((variation) => toNumber(variation?.stock) > 0);
};

const ensureOnlineSale = async (orderNsu, order) => {
  if (!order || order.onlineSaleId) {
    return;
  }

  const rawItems = Array.isArray(order.items) ? order.items : [];

  if (rawItems.length === 0) {
    return;
  }

  const saleId = orderNsu;
  const now = Date.now();
  const alerts = [];
  const saleItems = [];
  const stockOperations = [];

  for (const rawItem of rawItems) {
    const productId = sanitizeString(rawItem?.productId);
    const variationKey = sanitizeString(rawItem?.variationKey);
    const quantity = toNumber(rawItem?.quantity);

    const [productSnapshot, showcaseSnapshot, inventorySnapshot] = await Promise.all([
      productId ? database.ref(`products/${productId}`).get() : Promise.resolve(null),
      productId ? database.ref(`showcase/${productId}`).get() : Promise.resolve(null),
      productId ? database.ref(`inventory/${productId}`).get() : Promise.resolve(null),
    ]);

    const product = productSnapshot && productSnapshot.exists() ? productSnapshot.val() : null;
    const showcase = showcaseSnapshot && showcaseSnapshot.exists() ? showcaseSnapshot.val() : null;
    const inventory = inventorySnapshot && inventorySnapshot.exists() ? inventorySnapshot.val() : null;
    const variation = showcase?.variations?.[variationKey] || product?.variations?.[variationKey] || null;

    saleItems.push(
      buildSaleItemRecord({
        rawItem,
        product,
        showcase,
        variation,
      })
    );

    if (!productId || !variationKey) {
      alerts.push(`Item "${sanitizeString(rawItem?.description) || 'sem descricao'}" sem identificacao completa de produto/variacao.`);
      continue;
    }

    if (!product || !showcase || !inventory || !variation) {
      alerts.push(`Produto ${productId} nao encontrado no estoque publicado para reserva online.`);
      continue;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      alerts.push(`Quantidade invalida para o produto ${productId}.`);
      continue;
    }

    const currentVariationStock = toNumber(variation.stock);
    const currentAvailable = toNumber(inventory.available);

    if (currentVariationStock < quantity || currentAvailable < quantity) {
      alerts.push(`Estoque insuficiente para ${sanitizeString(showcase.name) || productId}.`);
      continue;
    }

    stockOperations.push({
      productId,
      variationKey,
      quantity,
      inventory,
      showcase,
      product,
    });
  }

  const totalAmount = saleItems.reduce((sum, item) => sum + toNumber(item.lineTotal), 0);
  const totalItems = saleItems.reduce((sum, item) => sum + toNumber(item.quantity), 0);
  const needsReview = alerts.length > 0;
  const updates = {
    [`sales/${saleId}`]: {
      saleId,
      orderNsu,
      channel: 'online',
      source: 'site',
      paymentStatus: 'paid',
      fulfillmentStatus: needsReview ? 'pending_review' : 'pending_delivery',
      stockStatus: needsReview ? 'attention' : 'reserved',
      customer: order.customer || null,
      address: order.address || null,
      items: saleItems,
      totalAmount,
      totalItems,
      alerts: needsReview ? alerts : null,
      createdAt: toNumber(order.createdAt) || now,
      paidAt: now,
      updatedAt: now,
    },
    [`checkoutOrders/${orderNsu}/onlineSaleId`]: saleId,
    [`checkoutOrders/${orderNsu}/deliveryStatus`]: needsReview ? 'pending_review' : 'pending_delivery',
    [`checkoutOrders/${orderNsu}/stockStatus`]: needsReview ? 'attention' : 'reserved',
    [`checkoutOrders/${orderNsu}/updatedAt`]: admin.database.ServerValue.TIMESTAMP,
  };

  if (!needsReview) {
    for (const operation of stockOperations) {
      const variationKey = operation.variationKey;
      const showcaseVariations = {
        ...(operation.showcase?.variations || {}),
      };
      const productVariations = {
        ...(operation.product?.variations || {}),
      };
      const showcaseVariation = showcaseVariations[variationKey] || {};
      const productVariation = productVariations[variationKey] || {};
      const nextVariationStock = toNumber(showcaseVariation.stock || productVariation.stock) - operation.quantity;

      showcaseVariations[variationKey] = {
        ...showcaseVariation,
        stock: nextVariationStock,
      };

      productVariations[variationKey] = {
        ...productVariation,
        stock: nextVariationStock,
      };

      const nextAvailable = toNumber(operation.inventory.available) - operation.quantity;
      const nextReserved = toNumber(operation.inventory.reserved) + operation.quantity;
      const movementRef = database.ref('stockMovements').push();

      if (movementRef.key) {
        updates[`stockMovements/${movementRef.key}`] = {
          productId: operation.productId,
          variation: variationKey,
          quantity: operation.quantity,
          type: 'reserve_online_sale',
          saleId,
          orderNsu,
          createdAt: now,
        };
      }

      updates[`inventory/${operation.productId}`] = {
        total: toNumber(operation.inventory.total),
        reserved: nextReserved,
        available: nextAvailable,
      };
      updates[`showcase/${operation.productId}/variations`] = showcaseVariations;
      updates[`showcase/${operation.productId}/stock`] = hasAvailableVariationStock(showcaseVariations);
      updates[`showcase/${operation.productId}/updatedAt`] = now;
      updates[`products/${operation.productId}/variations`] = productVariations;
      updates[`products/${operation.productId}/updatedAt`] = now;
    }
  } else {
    updates[`checkoutOrders/${orderNsu}/alerts`] = alerts;
  }

  await database.ref().update(updates);
};

const buildStatusPayloadFromOrder = (order) => ({
  success: true,
  paid: Boolean(order?.payment?.paid),
  amount: Number(order?.payment?.amount || order?.totalAmount || 0),
  paid_amount: Number(order?.payment?.paidAmount || 0),
  installments: Number(order?.payment?.installments || 0),
  capture_method: sanitizeString(order?.payment?.captureMethod) || 'unknown',
  order_nsu: sanitizeString(order?.orderNsu),
  transaction_nsu: sanitizeString(order?.payment?.transactionNsu),
  slug: sanitizeString(order?.payment?.slug),
  receipt_url: sanitizeString(order?.payment?.receiptUrl) || undefined,
  source: 'webhook',
});

const updateOrderPayment = async (orderNsu, paymentData) => {
  const orderRef = database.ref(`checkoutOrders/${orderNsu}`);

  await orderRef.update({
    status: paymentData.paid ? 'paid' : 'awaiting_payment',
    payment: {
      amount: paymentData.amount,
      paid: paymentData.paid,
      paidAmount: paymentData.paidAmount,
      installments: paymentData.installments,
      captureMethod: paymentData.captureMethod,
      transactionNsu: paymentData.transactionNsu,
      slug: paymentData.slug,
      receiptUrl: paymentData.receiptUrl || null,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
      source: paymentData.source,
    },
    updatedAt: admin.database.ServerValue.TIMESTAMP,
  });

  if (paymentData.paid) {
    const snapshot = await orderRef.get();
    await ensureOnlineSale(orderNsu, snapshot.val());
  }
};

exports.createCheckout = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Metodo nao permitido.' });
    return;
  }

  try {
    const items = normalizeItems(req.body?.items);
    const customer = normalizeCustomer(req.body?.customer);
    const address = normalizeAddress(req.body?.address);
    const orderNsu = createOrderNsu();
    const orderRef = database.ref(`checkoutOrders/${orderNsu}`);

    await orderRef.set(buildOrderRecord({ orderNsu, items, customer, address }));

    const redirectUrl = buildRedirectUrl();
    const webhookUrl = buildWebhookUrl();

    const response = await fetch(`${INFINITEPAY_API_BASE_URL}/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        handle: INFINITEPAY_HANDLE,
        redirect_url: redirectUrl,
        webhook_url: webhookUrl,
        order_nsu: orderNsu,
        items,
        customer: customer || undefined,
        address: address || undefined,
      }),
    });

    if (!response.ok) {
      const message = await buildErrorMessage(response);

      await orderRef.update({
        status: 'checkout_error',
        errorMessage: message,
        updatedAt: admin.database.ServerValue.TIMESTAMP,
      });

      res.status(502).json({ message });
      return;
    }

    const data = await response.json();

    await orderRef.update({
      status: 'awaiting_payment',
      paymentUrl: sanitizeString(data?.url),
      redirectUrl,
      webhookUrl,
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });

    res.status(200).json({
      url: sanitizeString(data?.url),
      orderNsu,
    });
  } catch (error) {
    logger.error('Erro ao criar checkout da InfinitePay.', error);
    res.status(400).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel criar o checkout.',
    });
  }
});

exports.paymentStatus = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Metodo nao permitido.' });
    return;
  }

  const orderNsu = sanitizeString(req.body?.orderNsu);
  const transactionNsu = sanitizeString(req.body?.transactionNsu);
  const slug = sanitizeString(req.body?.slug);

  if (!orderNsu || !transactionNsu || !slug) {
    res.status(400).json({ message: 'orderNsu, transactionNsu e slug sao obrigatorios.' });
    return;
  }

  try {
    const orderSnapshot = await database.ref(`checkoutOrders/${orderNsu}`).get();
    const order = orderSnapshot.val();

    if (order?.payment?.paid && sanitizeString(order?.payment?.transactionNsu) === transactionNsu) {
      await ensureOnlineSale(orderNsu, order);
      res.status(200).json(buildStatusPayloadFromOrder(order));
      return;
    }

    const response = await fetch(`${INFINITEPAY_API_BASE_URL}/payment_check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        handle: INFINITEPAY_HANDLE,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug,
      }),
    });

    if (!response.ok) {
      const message = await buildErrorMessage(response);
      res.status(502).json({ message });
      return;
    }

    const result = await response.json();
    const normalizedStatus = {
      amount: Number(result?.amount || 0),
      paid: Boolean(result?.paid),
      paidAmount: Number(result?.paid_amount || 0),
      installments: Number(result?.installments || 0),
      captureMethod: sanitizeString(result?.capture_method) || 'unknown',
      transactionNsu,
      slug,
      receiptUrl: sanitizeString(req.body?.receiptUrl) || null,
      source: 'payment_check',
    };

    await updateOrderPayment(orderNsu, normalizedStatus);

    res.status(200).json({
      success: Boolean(result?.success),
      paid: normalizedStatus.paid,
      amount: normalizedStatus.amount,
      paid_amount: normalizedStatus.paidAmount,
      installments: normalizedStatus.installments,
      capture_method: normalizedStatus.captureMethod,
      order_nsu: orderNsu,
      transaction_nsu: transactionNsu,
      slug,
      receipt_url: normalizedStatus.receiptUrl || undefined,
      source: 'payment_check',
    });
  } catch (error) {
    logger.error('Erro ao consultar status do pagamento.', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Nao foi possivel consultar o pagamento.',
    });
  }
});

exports.infinitePayWebhook = onRequest({ region: 'us-central1', cors: true }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ success: false, message: 'Metodo nao permitido.' });
    return;
  }

  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  const orderNsu = sanitizeString(payload.order_nsu);

  const webhookRef = database.ref('infinitePayWebhooks').push();
  await webhookRef.set({
    orderNsu: orderNsu || null,
    payload,
    receivedAt: admin.database.ServerValue.TIMESTAMP,
  });

  if (!orderNsu) {
    res.status(400).json({ success: false, message: 'Pedido nao encontrado' });
    return;
  }

  const orderRef = database.ref(`checkoutOrders/${orderNsu}`);
  const orderSnapshot = await orderRef.get();

  if (!orderSnapshot.exists()) {
    res.status(400).json({ success: false, message: 'Pedido nao encontrado' });
    return;
  }

  await updateOrderPayment(orderNsu, {
    amount: Number(payload.amount || 0),
    paid: true,
    paidAmount: Number(payload.paid_amount || 0),
    installments: Number(payload.installments || 0),
    captureMethod: sanitizeString(payload.capture_method) || 'unknown',
    transactionNsu: sanitizeString(payload.transaction_nsu),
    slug: sanitizeString(payload.invoice_slug),
    receiptUrl: sanitizeString(payload.receipt_url) || null,
    source: 'webhook',
  });

  await orderRef.update({
    webhookId: webhookRef.key,
    webhookReceivedAt: admin.database.ServerValue.TIMESTAMP,
  });

  res.status(200).json({ success: true, message: null });
});
