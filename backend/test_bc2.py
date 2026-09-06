import urllib.request
import json
def test(coin):
    req = urllib.request.Request(f'https://api.blockchair.com/{coin}/stats', headers={'User-Agent': 'Mozilla/5.0'})
    res = urllib.request.urlopen(req).read().decode()
    data = json.loads(res)['data']
    print(coin, "Addresses:", data.get('hodling_addresses') or data.get('accounts'))
test('ethereum')
test('solana')
