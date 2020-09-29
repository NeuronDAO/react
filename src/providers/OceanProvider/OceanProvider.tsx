import React, {
  useContext,
  useState,
  useEffect,
  createContext,
  ReactElement,
  useCallback,
  ReactNode
} from 'react'
import Web3 from 'web3'
import { provider } from 'web3-core'
import ProviderStatus from './ProviderStatus'
import { Ocean, Logger, Account, Config } from '@oceanprotocol/lib'
import Web3Modal, { ICoreOptions } from 'web3modal'
import { getDefaultProviders } from './getDefaultProviders'
import { getAccountId, getBalance } from '../../utils'

interface Balance {
  eth: string | undefined
  ocean: string | undefined
}

export type OceanContextType = {
  web3?: Web3
  web3Provider?: provider
  web3Modal?: Web3Modal
  ocean?: Ocean
  config?: Config
  account?: Account
  accountId: string
  balance?: Balance
  chainId?: number
  status?: ProviderStatus
  connect?: (config?: Config) => Promise<void>
  logout?: () => Promise<void>
  refreshBalance?: () => Promise<void>
}

const DefaultOceanContextValues = {
  accountId: ''
}

export const OceanContext = createContext<OceanContextType>(
  DefaultOceanContextValues
)

function OceanProvider({
  initialConfig,
  web3ModalOpts,
  children
}: {
  initialConfig: Config
  web3ModalOpts?: Partial<ICoreOptions>
  children: ReactNode
}): ReactElement {
  const [web3, setWeb3] = useState<Web3>()
  const [web3Provider, setWeb3Provider] = useState<provider>()
  const [ocean, setOcean] = useState<Ocean>()
  const [web3Modal, setWeb3Modal] = useState<Web3Modal>()
  const [chainId, setChainId] = useState<number>()
  const [account, setAccount] = useState<Account>()
  const [accountId, setAccountId] = useState<string>()
  const [config, setConfig] = useState<Config>(initialConfig)
  const [balance, setBalance] = useState<Balance>()
  const [status, setStatus] = useState<ProviderStatus>(
    ProviderStatus.NOT_AVAILABLE
  )

  const init = useCallback(async () => {
    Logger.log('Ocean Provider init')
    window &&
      window.ethereum &&
      (window.ethereum.autoRefreshOnNetworkChange = false)

    Logger.log('Web3Modal init.')

    const web3ModalInstance = new Web3Modal(
      web3ModalOpts || (await getDefaultProviders())
    )
    setWeb3Modal(web3ModalInstance)
    Logger.log('Web3Modal instance created.', web3ModalInstance)
  }, [web3ModalOpts])

  const connect = useCallback(
    async (newConfig?: Config) => {
      try {
        Logger.log('Connecting ...', newConfig)

        newConfig && setConfig(newConfig)

        // Naz: not entirely sure that const provider is of type web3-core provider. Please, double-check
        const provider: provider = await web3Modal?.connect()
        setWeb3Provider(provider)

        const web3 = new Web3(provider)
        setWeb3(web3)
        Logger.log('Web3 created.', web3)

        const chainId = web3 && (await web3.eth.getChainId())
        setChainId(chainId)
        Logger.log('chain id ', chainId)

        config.web3Provider = web3
        const ocean = await Ocean.getInstance(config)
        setOcean(ocean)
        Logger.log('Ocean instance created.', ocean)

        setStatus(ProviderStatus.CONNECTED)

        const account = (await ocean.accounts.list())[0]
        setAccount(account)
        Logger.log('Account ', account)

        const accountId = await getAccountId(web3)
        setAccountId(accountId)
        Logger.log('account id', accountId)

        const balance = await getBalance(account)
        setBalance(balance)
        Logger.log('balance', JSON.stringify(balance))
      } catch (error) {
        Logger.error(error)
      }
    },
    [config, web3Modal]
  )

  // On mount setup Web3Modal instance
  useEffect(() => {
    init()
  }, [init])

  // Connect automatically to cached provider if present
  useEffect(() => {
    if (!web3Modal) return
    web3Modal.cachedProvider && connect()
  }, [web3Modal, connect])

  async function refreshBalance() {
    const balance = account && (await getBalance(account))
    setBalance(balance)
  }
  async function logout() {
    // TODO: #67 check what is the proper way to logout
    web3Modal?.clearCachedProvider()
  }

  // TODO: #68 Refetch balance periodically, or figure out some event to subscribe to
  // Naz: just set timer?

  useEffect(() => {
    const handleAccountsChanged = async (accounts: string[]) => {
      Logger.debug("Handling 'accountsChanged' event with payload", accounts)
      connect()
    }
    // web3Modal && web3Modal.on('connect', handleConnect)

    if (web3Modal) {
      web3Modal.on('accountsChanged', handleAccountsChanged)
      return () => {
        // Naz: I think off is what you need here?
        web3Modal.off('accountsChanged', handleAccountsChanged)
      }
    }

    // ! Naz: web3-core provider does not have on and removeListener
    // if (web3Provider && typeof web3Provider !== 'string') {
    //   web3Provider.on('accountsChanged', handleAccountsChanged)
    //   // web3Provider.on('chainChanged', handleNetworkChanged)

    //   return () => {
    //     web3Provider.removeListener('accountsChanged', handleAccountsChanged)
    //     //  web3Provider.removeListener('chainChanged', handleNetworkChanged)
    //   }
    // }
  }, [web3Modal, web3Provider, connect])

  return (
    <OceanContext.Provider
      value={{
        web3,
        web3Provider,
        web3Modal,
        ocean,
        account,
        accountId: accountId || '',
        balance,
        chainId,
        status,
        config,
        connect,
        logout,
        refreshBalance
      }}
    >
      {children}
    </OceanContext.Provider>
  )
}

export { OceanProvider, Balance }
export default OceanProvider
