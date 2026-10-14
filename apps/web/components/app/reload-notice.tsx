import { RefreshCw } from 'lucide-react'

import { Banner, BannerAction, BannerActions, BannerTitle, type BannerStatus } from '@/components/ui/banner'

interface ReloadNoticeProps {
	status: Extract<BannerStatus, 'warning' | 'error'>
	text: string
	reloadLabel: string
	pending?: boolean
	onReload: () => void
}

export function ReloadNotice({ status, text, reloadLabel, pending = false, onReload }: ReloadNoticeProps) {
	return (
		<Banner status={status} role="alert">
			<BannerTitle>{text}</BannerTitle>
			<BannerActions className="col-start-2 row-start-2 my-0 mt-2 ml-0">
				<BannerAction leadingIcon={RefreshCw} loading={pending} onClick={onReload}>
					{reloadLabel}
				</BannerAction>
			</BannerActions>
		</Banner>
	)
}
