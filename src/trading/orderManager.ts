// src/trading/orderManager.ts
import { BinanceClient } from '../binance/client';

// 订单类型枚举
export enum OrderType {
    LIMIT = 'LIMIT',
    MARKET = 'MARKET',
    STOP = 'STOP',
    STOP_MARKET = 'STOP_MARKET',
    TAKE_PROFIT = 'TAKE_PROFIT',
    TAKE_PROFIT_MARKET = 'TAKE_PROFIT_MARKET',
    TRAILING_STOP_MARKET = 'TRAILING_STOP_MARKET'
}

// 订单方向枚举
export enum OrderSide {
    BUY = 'BUY',
    SELL = 'SELL'
}

// 订单时间有效方式枚举
export enum TimeInForce {
    GTC = 'GTC',  // Good Till Cancel
    IOC = 'IOC',  // Immediate Or Cancel
    FOK = 'FOK'   // Fill or Kill
}

// 下单参数接口
export interface NewOrderParams {
    symbol: string;
    side: OrderSide;
    type: OrderType;
    quantity: number;
    price?: number;
    timeInForce?: TimeInForce;
    stopPrice?: number;
    callbackRate?: number;
    activationPrice?: number;
    workingType?: 'MARK_PRICE' | 'CONTRACT_PRICE';
    reduceOnly?: boolean;
    closePosition?: boolean;
    positionSide?: 'BOTH' | 'LONG' | 'SHORT';
}

// 订单响应接口
export interface OrderResponse {
    orderId: number;
    symbol: string;
    status: string;
    clientOrderId: string;
    price: string;
    avgPrice: string;
    origQty: string;
    executedQty: string;
    cumQuote: string;
    timeInForce: string;
    type: string;
    reduceOnly: boolean;
    closePosition: boolean;
    side: string;
    positionSide: string;
    stopPrice: string;
    workingType: string;
    origType: string;
    updateTime: number;
    transactTime: number;
}

export class OrderManager {
    private binanceClient: BinanceClient;

    constructor(binanceClient: BinanceClient) {
        this.binanceClient = binanceClient;
    }

    /**
     * Round quantity to the allowed precision for the symbol
     * @param quantity The quantity to round
     * @param symbol The trading pair symbol
     * @returns Rounded quantity
     */
    private roundQuantity(quantity: number, symbol: string): number {
        // Different symbols have different precision requirements
        // For most major pairs like BTCUSDT, 3 decimal places are sufficient
        // For smaller altcoins, you might need fewer decimal places
        if (symbol.includes('BTC')) {
            return Math.round(quantity * 1000) / 1000; // 3 decimal places
        } else if (symbol.includes('ETH')) {
            return Math.round(quantity * 100) / 100; // 2 decimal places
        } else {
            return Math.round(quantity * 10) / 10; // 1 decimal place for most altcoins
        }
    }

    /**
     * Round price to the allowed precision for the symbol
     * @param price The price to round
     * @param symbol The trading pair symbol
     * @returns Rounded price
     */
    private roundPrice(price: number, symbol: string): number {
        // Different symbols have different price precision requirements
        // For most major pairs, 2 decimal places are sufficient
        // For smaller altcoins, you might need more decimal places
        if (symbol.includes('BTC')) {
            return Math.round(price * 100) / 100; // 2 decimal places
        } else if (symbol.includes('ETH')) {
            return Math.round(price * 100) / 100; // 2 decimal places
        } else {
            return Math.round(price * 10000) / 10000; // 4 decimal places for most altcoins
        }
    }

    /**
     * Create a new order
     * https://developers.binance.com/docs/zh-CN/derivatives/usds-margined-futures/trade/rest-api/New-Order
     */
    async createOrder(params: NewOrderParams): Promise<OrderResponse> {
        console.log(`📝 Creating ${params.type} order for ${params.symbol}...`);
        
        // Build request parameters
        const requestParams: Record<string, any> = {
            symbol: params.symbol,
            side: params.side,
            type: params.type,
            quantity: this.roundQuantity(params.quantity, params.symbol).toString() // Round quantity
        };
        
        // Add type-specific parameters
        if (params.price && params.type === OrderType.LIMIT) {
            requestParams.price = this.roundPrice(params.price, params.symbol).toString(); // Round price
            requestParams.timeInForce = params.timeInForce || TimeInForce.GTC;
        }
        
        if (params.stopPrice && (params.type === OrderType.STOP || params.type === OrderType.STOP_MARKET)) {
            requestParams.stopPrice = this.roundPrice(params.stopPrice, params.symbol).toString(); // Round stop price
        }
        
        if (params.type === OrderType.TRAILING_STOP_MARKET) {
            if (params.callbackRate) {
                requestParams.callbackRate = params.callbackRate.toString();
            }
            if (params.activationPrice) {
                requestParams.activationPrice = this.roundPrice(params.activationPrice, params.symbol).toString(); // Round activation price
            }
        }
        
        if (params.workingType) {
            requestParams.workingType = params.workingType;
        }
        
        if (params.reduceOnly !== undefined) {
            requestParams.reduceOnly = params.reduceOnly.toString();
        }
        
        if (params.closePosition !== undefined) {
            requestParams.closePosition = params.closePosition.toString();
        }
        
        if (params.positionSide) {
            requestParams.positionSide = params.positionSide;
        }
        
        try {
            console.log(`📝 Creating ${params.type} order for ${params.symbol} with params:`, requestParams);
            
            const response = await this.binanceClient.sendSignedRequest('POST', '/fapi/v1/order', requestParams);
            
            console.log(`✅ Order created successfully. Order ID: ${response.orderId}`);
            
            return {
                orderId: response.orderId,
                symbol: response.symbol,
                status: response.status,
                clientOrderId: response.clientOrderId,
                price: response.price,
                avgPrice: response.avgPrice,
                origQty: response.origQty,
                executedQty: response.executedQty,
                cumQuote: response.cumQuote,
                timeInForce: response.timeInForce,
                type: response.type,
                reduceOnly: response.reduceOnly,
                closePosition: response.closePosition,
                side: response.side,
                positionSide: response.positionSide,
                stopPrice: response.stopPrice,
                workingType: response.workingType,
                origType: response.origType,
                updateTime: response.updateTime,
                transactTime: response.transactTime
            };
        } catch (error) {
            console.error(`❌ Failed to create order for ${params.symbol}:`, error);
            throw error;
        }
    }

    /**
     * Create a market order
     */
    async createMarketOrder(symbol: string, side: OrderSide, quantity: number, 
                          reduceOnly?: boolean, positionSide?: 'BOTH' | 'LONG' | 'SHORT'): Promise<OrderResponse> {
        return await this.createOrder({
            symbol,
            side,
            type: OrderType.MARKET,
            quantity,
            reduceOnly,
            positionSide
        });
    }

    /**
     * Create a limit order
     */
    async createLimitOrder(symbol: string, side: OrderSide, quantity: number, price: number,
                          timeInForce: TimeInForce = TimeInForce.GTC, reduceOnly?: boolean,
                          positionSide?: 'BOTH' | 'LONG' | 'SHORT'): Promise<OrderResponse> {
        return await this.createOrder({
            symbol,
            side,
            type: OrderType.LIMIT,
            quantity,
            price,
            timeInForce,
            reduceOnly,
            positionSide
        });
    }

    /**
     * Create a stop order
     */
    async createStopOrder(symbol: string, side: OrderSide, quantity: number, stopPrice: number,
                         price?: number, timeInForce?: TimeInForce, reduceOnly?: boolean,
                         positionSide?: 'BOTH' | 'LONG' | 'SHORT'): Promise<OrderResponse> {
        const orderType = price ? OrderType.STOP : OrderType.STOP_MARKET;
        
        return await this.createOrder({
            symbol,
            side,
            type: orderType,
            quantity,
            price,
            stopPrice,
            timeInForce,
            reduceOnly,
            positionSide: 'SHORT'
        });
    }

    /**
     * Create a take profit order
     */
    async createTakeProfitOrder(symbol: string, side: OrderSide, quantity: number, stopPrice: number,
                               price?: number, timeInForce?: TimeInForce, reduceOnly?: boolean,
                               positionSide?: 'BOTH' | 'LONG' | 'SHORT'): Promise<OrderResponse> {
        const orderType = price ? OrderType.TAKE_PROFIT : OrderType.TAKE_PROFIT_MARKET;
        
        return await this.createOrder({
            symbol,
            side,
            type: orderType,
            quantity,
            price,
            stopPrice,
            timeInForce,
            reduceOnly,
            positionSide
        });
    }

    /**
     * Cancel an order
     */
    async cancelOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any> {
        console.log(`🗑️  Cancelling order for ${symbol}...`);
        
        const params: Record<string, any> = { symbol };
        
        if (orderId) {
            params.orderId = orderId;
        } else if (origClientOrderId) {
            params.origClientOrderId = origClientOrderId;
        } else {
            throw new Error('Either orderId or origClientOrderId must be provided');
        }
        
        try {
            const response = await this.binanceClient.sendSignedRequest('DELETE', '/fapi/v1/order', params);
            console.log(`✅ Order cancelled successfully.`);
            return response;
        } catch (error) {
            console.error(`❌ Failed to cancel order for ${symbol}:`, error);
            throw error;
        }
    }

    /**
     * Get order status
     */
    async getOrder(symbol: string, orderId?: number, origClientOrderId?: string): Promise<any> {
        console.log(`🔍 Getting order status for ${symbol}...`);
        
        const params: Record<string, any> = { symbol };
        
        if (orderId) {
            params.orderId = orderId;
        } else if (origClientOrderId) {
            params.origClientOrderId = origClientOrderId;
        } else {
            throw new Error('Either orderId or origClientOrderId must be provided');
        }
        
        try {
            return await this.binanceClient.sendSignedRequest('GET', '/fapi/v1/order', params);
        } catch (error) {
            console.error(`❌ Failed to get order status for ${symbol}:`, error);
            throw error;
        }
    }
}