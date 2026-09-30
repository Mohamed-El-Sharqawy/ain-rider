import { createRedisCluster, createCache } from '@ain-rider/redis-client';

const REDIS_NODES = (process.env.REDIS_NODES || 'localhost:6379').split(',');

export const redisCluster = createRedisCluster({
  nodes: REDIS_NODES,
  keyPrefix: 'match:',
});

export const cache = createCache(redisCluster);

const UNREGISTER_DRIVER_LUA = `
local driverKey = KEYS[1]
local driver = redis.call('GET', driverKey)
if not driver then return 0 end
local data = cjson.decode(driver)
local h3Index = data.h3Index
local driverId = data.driverId
local cellKey = 'match:h3:cell:' .. h3Index
local cellData = redis.call('GET', cellKey)
if cellData then
  local drivers = cjson.decode(cellData)
  local filtered = {}
  for _, d in ipairs(drivers) do
    if d.driverId ~= driverId then
      table.insert(filtered, d)
    end
  end
  if #filtered > 0 then
    redis.call('SET', cellKey, cjson.encode(filtered), 'EX', ARGV[1])
  else
    redis.call('DEL', cellKey)
  end
end
redis.call('DEL', driverKey)
return 1
`;

const REGISTER_DRIVER_LUA = `
local driverKey = KEYS[1]
local newCellKey = KEYS[2]
local driverJson = ARGV[1]
local ttl = tonumber(ARGV[2])
local driverData = cjson.decode(driverJson)
local driverId = driverData.driverId
local prevJson = redis.call('GET', driverKey)
if prevJson then
  local prev = cjson.decode(prevJson)
  if prev.h3Index ~= driverData.h3Index then
    local oldCellKey = 'match:h3:cell:' .. prev.h3Index
    local oldCellData = redis.call('GET', oldCellKey)
    if oldCellData then
      local oldDrivers = cjson.decode(oldCellData)
      local filtered = {}
      for _, d in ipairs(oldDrivers) do
        if d.driverId ~= driverId then
          table.insert(filtered, d)
        end
      end
      if #filtered > 0 then
        redis.call('SET', oldCellKey, cjson.encode(filtered), 'EX', ttl)
      else
        redis.call('DEL', oldCellKey)
      end
    end
  end
end
local cellData = redis.call('GET', newCellKey)
local cellDrivers = {}
if cellData then
  cellDrivers = cjson.decode(cellData)
end
local updated = {}
for _, d in ipairs(cellDrivers) do
  if d.driverId ~= driverId then
    table.insert(updated, d)
  end
end
table.insert(updated, driverData)
redis.call('SET', newCellKey, cjson.encode(updated), 'EX', ttl)
redis.call('SET', driverKey, driverJson, 'EX', ttl)
return 1
`;

export const luaScripts = {
  unregisterDriver: redisCluster.defineCommand('unregisterDriver', {
    numberOfKeys: 1,
    lua: UNREGISTER_DRIVER_LUA,
  }),
  registerDriver: redisCluster.defineCommand('registerDriver', {
    numberOfKeys: 2,
    lua: REGISTER_DRIVER_LUA,
  }),
};
