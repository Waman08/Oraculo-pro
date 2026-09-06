import urllib.request
import json
req = urllib.request.Request('https://api.blockchair.com/bitcoin/stats', headers={'User-Agent': 'Mozilla/5.0'})
res = urllib.request.urlopen(req).read().decode()
data = json.loads(res)['data']
print("Blocks:", data.get('blocks'))
print("Transactions:", data.get('transactions'))
print("Hodling Addresses:", data.get('hodling_addresses'))
print("Hashrate:", data.get('hashrate_24h'))
