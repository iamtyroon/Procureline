import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function BlocklyEditorDialogs(props: {
    clearOpen: boolean;
    exitOpen: boolean;
    onClear: () => void;
    onClearOpenChange: (open: boolean) => void;
    onConfirmExit: () => void;
    onExitOpenChange: (open: boolean) => void;
}) {
    return (
        <>
            <AlertDialog open={props.exitOpen} onOpenChange={props.onExitOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Leave this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Unsaved local changes may be lost. Stay here to keep the local draft and recovery copy active, or leave the editor now.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Stay</AlertDialogCancel>
                        <AlertDialogAction onClick={props.onConfirmExit}>Leave</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={props.clearOpen} onOpenChange={props.onClearOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Start over on this draft?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This clears the current Blockly canvas and replaces the local recovery snapshot for this plan. Use Save afterwards if you want the cleared version synced to cloud.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Keep current draft</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(event) => {
                                event.preventDefault();
                                props.onClearOpenChange(false);
                                props.onClear();
                            }}
                        >
                            Clear plan
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
}
